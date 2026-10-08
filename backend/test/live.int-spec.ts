import { beforeAll, describe, expect, it } from 'vitest';

import { liveSnapshotSchema, type LiveSnapshot, type Order, type Product } from '@smart-restaurant/contracts';

import { OrderEventLog } from '../src/live/order-event-log.js';
import { useTestApp } from './support/context.js';
import { count, eventHead, sql } from './support/database.js';
import { eventsOf, has, isReady, openSse, type SseStream } from './support/sse.js';

const t = useTestApp({ listen: true });
let food: Product;
let drink: Product;

beforeAll(async () => {
  food = await t.fixtures.product('FOOD');
  drink = await t.fixtures.product('DRINK');
});

/** Opens a stream, runs `body`, and always closes the stream again. */
async function withStream<T>(
  path: string,
  headers: Record<string, string>,
  body: (stream: SseStream) => Promise<T>,
): Promise<T> {
  const stream = await openSse(t.app, path, headers);

  try {
    return await body(stream);
  } finally {
    stream.close();
  }
}

/**
 * Four events to replay: a party seated with its first order, an item added
 * later, and that item moved on. Items placed with the order have no event of
 * their own; they travel in `order.created`.
 */
async function someEvents(): Promise<void> {
  const order = await t.fixtures.order((await t.fixtures.table()).id, [food.id]);
  const added = await t.http.post(`/api/orders/${order.id}/items`, { productId: drink.id });
  await t.http.patch(`/api/orders/${order.id}/items/${added.body.id}`, { status: 'SERVED' });
}

describe('I-LIV snapshot', () => {
  it('01 shows every seated party at the current cursor', async () => {
    await t.fixtures.order((await t.fixtures.table()).id, [food.id]);
    await t.fixtures.seat((await t.fixtures.table()).id);

    const snapshot = await t.http.get<LiveSnapshot>('/api/live/snapshot');

    expect(snapshot.status).toBe(200);
    liveSnapshotSchema.parse(snapshot.body);
    expect(snapshot.body.cursor).toBe(await eventHead());
    expect(snapshot.body.sessions).toHaveLength(await count('Table_Session', 'closed_at IS NULL'));
  });

  it('02 keeps paid orders until the table is cleared', async () => {
    const order = await t.fixtures.order((await t.fixtures.table()).id, [drink.id]);
    await t.fixtures.pay(order);

    const beforeClearing = (await t.http.get<LiveSnapshot>('/api/live/snapshot')).body;
    expect(beforeClearing.orders.find((o) => o.id === order.id)?.status).toBe('CLOSED');

    await t.http.post(`/api/table-sessions/${order.tableSessionId}/close`);
    const afterClearing = (await t.http.get<LiveSnapshot>('/api/live/snapshot')).body;
    expect(afterClearing.orders.map((o) => o.id)).not.toContain(order.id);
    expect(afterClearing.sessions.map((s) => s.id)).not.toContain(order.tableSessionId);
  });

  it('03 shows a guest their own party, without who served them', async () => {
    const table = await t.fixtures.table();
    const guest = await t.fixtures.guest(table.id);
    const { employee } = await t.fixtures.employee('SERVICE');
    await t.fixtures.order(table.id, [food.id], { employeeId: employee.id });
    await t.fixtures.order((await t.fixtures.table()).id, [food.id]);

    const snapshot = (await guest.api.get<LiveSnapshot>('/api/live/snapshot')).body;

    expect(snapshot.sessions.map((s) => s.id)).toEqual([guest.session.id]);
    expect(snapshot.orders).toHaveLength(1);
    expect(snapshot.orders[0]).toMatchObject({ employeeId: null, employee: null });
  });

  it('04 shows kitchen and bar the open orders for their station, with only their items', async () => {
    const table = await t.fixtures.table();
    const mixed = await t.fixtures.order(table.id, [food.id, drink.id]);
    const drinksOnly = await t.fixtures.order(table.id, [drink.id]);
    const foodOnly = await t.fixtures.order(table.id, [food.id]);
    // Paid, but the party is still seated: service sees it, the kitchen has nothing left to do.
    const paidFood = await t.fixtures.pay(await t.fixtures.order(table.id, [food.id]));
    const cook = await t.fixtures.staff('KITCHEN');
    const bartender = await t.fixtures.staff('BAR');

    const kitchen = (await cook.api.get<LiveSnapshot>('/api/live/snapshot')).body;
    liveSnapshotSchema.parse(kitchen);
    const kitchenIds = kitchen.orders.map((o) => o.id);
    expect(kitchen.orders.find((o) => o.id === mixed.id)?.orderItems.map((i) => i.product.type)).toEqual(['FOOD']);
    expect(kitchenIds).toContain(foodOnly.id);
    expect(kitchenIds).not.toContain(drinksOnly.id);
    expect(kitchenIds).not.toContain(paidFood.id);
    expect(new Set(kitchen.sessions.map((s) => s.id))).toEqual(new Set(kitchen.orders.map((o) => o.tableSessionId)));

    const bar = (await bartender.api.get<LiveSnapshot>('/api/live/snapshot')).body;
    const barIds = bar.orders.map((o) => o.id);
    expect(barIds).toEqual(expect.arrayContaining([mixed.id, drinksOnly.id]));
    expect(barIds).not.toContain(foodOnly.id);
    expect(bar.orders.every((o) => o.orderItems.length > 0)).toBe(true);
    expect(bar.orders.flatMap((o) => o.orderItems).every((i) => i.product.type === 'DRINK')).toBe(true);

    const everything = (await t.http.get<LiveSnapshot>('/api/live/snapshot')).body;
    expect(everything.orders.map((o) => o.id)).toContain(paidFood.id);
  });
});

describe('I-LIV stream', () => {
  it('05 needs a valid starting point', async () => {
    for (const [path, headers] of [
      ['/api/live/events', {}],
      ['/api/live/events?since=-1', {}],
      ['/api/live/events?since=0', { 'last-event-id': 'abc' }],
      ['/api/live/events?since=0', { 'last-event-id': '-1' }],
    ] as const) {
      await withStream(path, headers, async (stream) => expect(stream.status).toBe(400));
    }
  });

  it('06 replays the backlog, then says it is ready', async () => {
    await someEvents();
    const head = await eventHead();

    await withStream(`/api/live/events?since=${head - 3}`, {}, async (stream) => {
      const messages = await stream.waitFor(isReady);

      expect(messages.map((m) => Number(m.id))).toEqual([head - 2, head - 1, head, head]);
      expect(messages.at(-1)).toMatchObject({ event: 'ready', data: { cursor: head } });
      for (const message of messages.slice(0, 3)) {
        expect(message.event).toBe(message.data.type);
      }
    });
  });

  it('07 delivers a change as it commits', async () => {
    const table = await t.fixtures.table();
    const head = await eventHead();

    await withStream(`/api/live/events?since=${head}`, {}, async (stream) => {
      await stream.waitFor(isReady);
      await t.fixtures.seat(table.id);
      const messages = await stream.waitFor(has('session.opened'));

      expect(eventsOf(messages)).toEqual(['ready', 'session.opened']);
      expect(Number(messages[1].id)).toBe(head + 1);
    });
  });

  it('08 resumes from Last-Event-ID rather than since, unless it is empty', async () => {
    await someEvents();
    const head = await eventHead();

    await withStream('/api/live/events?since=0', { 'last-event-id': String(head - 1) }, async (stream) => {
      expect((await stream.waitFor(isReady)).map((m) => Number(m.id))).toEqual([head, head]);
    });

    await withStream(`/api/live/events?since=${head}`, { 'last-event-id': '' }, async (stream) => {
      expect(await stream.waitFor(isReady)).toEqual([expect.objectContaining({ event: 'ready', id: String(head) })]);
    });
  });

  it('09 asks a client from the future to resync, and closes', async () => {
    await withStream(`/api/live/events?since=${(await eventHead()) + 100}`, {}, async (stream) => {
      expect(await stream.closed()).toEqual([
        expect.objectContaining({ event: 'resync', data: { reason: 'cursor_unknown' } }),
      ]);
    });
  });

  it('10 asks a client to resync when the changes it missed are gone', async () => {
    await someEvents();
    const head = await eventHead();
    await sql('DELETE FROM "Order_Event" WHERE order_event_id <= $1', [head - 2]);

    await withStream(`/api/live/events?since=${head - 3}`, {}, async (stream) => {
      const messages = await stream.closed();

      expect(messages.at(-1)).toMatchObject({ event: 'resync', data: { reason: 'cursor_expired' } });
      expect(eventsOf(messages)).not.toContain('ready');
    });
  });

  it('11 shows a guest only their party, without who served them, and ends when the table is cleared', async () => {
    const [table, elsewhere] = [await t.fixtures.table(), await t.fixtures.table()];
    const guest = await t.fixtures.guest(table.id);
    const { employee } = await t.fixtures.employee('SERVICE');
    const head = await eventHead();

    await withStream(`/api/live/events?since=${head}`, { cookie: guest.cookie }, async (stream) => {
      await stream.waitFor(isReady);
      await t.fixtures.order(elsewhere.id, [food.id]);
      const own = await t.fixtures.order(table.id, [drink.id], { employeeId: employee.id });
      await t.fixtures.pay(own);
      await t.http.post(`/api/table-sessions/${guest.session.id}/close`);
      const messages = await stream.closed();

      // The other party's order is missing; serving the drink takes three moves.
      expect(eventsOf(messages)).toEqual([
        'ready',
        'order.created',
        'item.status_changed',
        'item.status_changed',
        'item.status_changed',
        'order.closed',
        'session.closed',
      ]);
      const created = messages[1].data.data.order as Order;
      expect(created.id).toBe(own.id);
      expect(created).toMatchObject({ employeeId: null, employee: null });
    });
  });

  it('12 shows the bar its drinks only', async () => {
    const bartender = await t.fixtures.staff('BAR');
    const table = await t.fixtures.table();
    const head = await eventHead();

    await withStream(`/api/live/events?since=${head}`, { cookie: bartender.cookie }, async (stream) => {
      await stream.waitFor(isReady);
      const order = await t.fixtures.order(table.id);
      await t.http.post(`/api/orders/${order.id}/items`, { productId: food.id });
      await t.http.post(`/api/orders/${order.id}/items`, { productId: drink.id });
      const messages = await stream.waitFor(has('item.created'));

      // Hidden: session.opened, the empty order.created and the food item.
      expect(eventsOf(messages)).toEqual(['ready', 'item.created']);
      expect(messages[1].data.data.item.product.type).toBe('DRINK');
      expect(Number(messages[1].id)).toBe(head + 4);
    });
  });

  it('13 shows the kitchen its items of an order, and nothing about tables', async () => {
    const cook = await t.fixtures.staff('KITCHEN');
    const table = await t.fixtures.table();
    const head = await eventHead();

    await withStream(`/api/live/events?since=${head}`, { cookie: cook.cookie }, async (stream) => {
      await stream.waitFor(isReady);
      const order = await t.fixtures.order(table.id, [food.id, drink.id]);
      await t.fixtures.pay(order);
      await t.http.post(`/api/table-sessions/${order.tableSessionId}/close`);
      // A marker the kitchen sees, so the test knows everything before it has arrived.
      const marker = await t.fixtures.order((await t.fixtures.table()).id, [food.id]);
      const messages = await stream.waitFor(
        (received) => received.some((m) => m.event === 'order.created' && m.data.data.order.id === marker.id),
      );

      expect(eventsOf(messages)).not.toContain('session.opened');
      expect(eventsOf(messages)).not.toContain('session.closed');
      const created = messages.find((m) => m.event === 'order.created')?.data.data.order as Order;
      expect(created.id).toBe(order.id);
      expect(created.orderItems.map((i) => i.product.type)).toEqual(['FOOD']);
      const moves = messages.filter((m) => m.event === 'item.status_changed');
      expect(moves.every((m) => m.data.data.item.product.type === 'FOOD')).toBe(true);
    });
  });

  it('14 lets the frontend read the stream across origins', async () => {
    await withStream(`/api/live/events?since=${await eventHead()}`, { origin: 'http://localhost:4200' }, async (stream) => {
      expect(stream.headers.get('access-control-allow-origin')).toBe('http://localhost:4200');
      expect(stream.headers.get('access-control-allow-credentials')).toBe('true');
      expect(stream.headers.get('content-type')).toContain('text/event-stream');
    });
  });
});

describe('I-LIV event retention', () => {
  it('15 prunes events older than 24 hours as a prefix of the log', async () => {
    await someEvents();
    const head = await eventHead();
    const [oldest, young, old] = [head - 3, head - 2, head - 1];
    // occurred_at is when a transaction started, so an older event can carry a higher id.
    await sql(
      `UPDATE "Order_Event" SET occurred_at = now() - interval '25 hours' WHERE order_event_id IN ($1, $2)`,
      [oldest, old],
    );

    const pruned = await t.app.get(OrderEventLog).prune();

    expect(pruned).toBeGreaterThanOrEqual(3);
    const [{ first }] = await sql<{ first: number }>('SELECT min(order_event_id)::int AS first FROM "Order_Event"');
    expect(first).toBe(head);
    expect(await count('Order_Event', 'order_event_id = $1', [young])).toBe(0);

    await withStream(`/api/live/events?since=${oldest - 1}`, {}, async (stream) => {
      expect((await stream.closed()).at(-1)).toMatchObject({
        event: 'resync',
        data: { reason: 'cursor_expired' },
      });
    });
  });
});
