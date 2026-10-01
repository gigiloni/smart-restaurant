import { beforeAll, describe, expect, it } from 'vitest';

import { liveSnapshotSchema, type LiveSnapshot, type Product } from '@smart-restaurant/contracts';

import { useTestApp } from './support/context.js';
import { count, eventHead, sql } from './support/database.js';
import { readSse, settle, type SseMessage } from './support/sse.js';

const t = useTestApp({ listen: true });
let food: Product;
let drink: Product;

beforeAll(async () => {
  food = await t.fixtures.product('FOOD');
  drink = await t.fixtures.product('DRINK');
});

const eventsOf = (messages: SseMessage[]) => messages.map((m) => m.event);
const untilReady = (messages: SseMessage[]) => messages.some((m) => m.event === 'ready');

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

  it("03 shows a guest their own party, without who served them", async () => {
    const table = await t.fixtures.table();
    const guest = await t.fixtures.guest(table.id);
    const { employee } = await t.fixtures.employee('SERVICE');
    await t.fixtures.order(table.id, [food.id], { employeeId: employee.id });

    const snapshot = (await guest.api.get<LiveSnapshot>('/api/live/snapshot')).body;

    expect(snapshot.sessions.map((s) => s.id)).toEqual([guest.session.id]);
    expect(snapshot.orders).toHaveLength(1);
    expect(snapshot.orders[0]).toMatchObject({ employeeId: null, employee: null });
  });

  it('04 shows kitchen and bar the open orders for their station, with only their items', async () => {
    const table = await t.fixtures.table();
    const mixed = await t.fixtures.order(table.id, [food.id, drink.id]);
    const drinksOnly = await t.fixtures.order(table.id, [drink.id]);
    const cook = await t.fixtures.staff('KITCHEN');
    const bartender = await t.fixtures.staff('BAR');

    const kitchen = (await cook.api.get<LiveSnapshot>('/api/live/snapshot')).body;
    liveSnapshotSchema.parse(kitchen);
    expect(kitchen.orders.find((o) => o.id === mixed.id)?.orderItems.map((i) => i.product.type)).toEqual(['FOOD']);
    expect(kitchen.orders.map((o) => o.id)).not.toContain(drinksOnly.id);
    expect(kitchen.orders.every((o) => o.status === 'OPEN')).toBe(true);
    expect(new Set(kitchen.sessions.map((s) => s.id))).toEqual(
      new Set(kitchen.orders.map((o) => o.tableSessionId)),
    );

    const bar = (await bartender.api.get<LiveSnapshot>('/api/live/snapshot')).body;
    expect(bar.orders.map((o) => o.id)).toContain(drinksOnly.id);
    expect(bar.orders.flatMap((o) => o.orderItems).every((i) => i.product.type === 'DRINK')).toBe(true);
  });
});

describe('I-LIV stream', () => {
  it('05 needs a valid starting point', async () => {
    expect((await readSse(t.app, '/api/live/events')).status).toBe(400);
    expect((await readSse(t.app, '/api/live/events?since=-1')).status).toBe(400);
    expect(
      (await readSse(t.app, '/api/live/events?since=0', { headers: { 'last-event-id': 'abc' } })).status,
    ).toBe(400);
  });

  it('06 replays the backlog, then says it is ready', async () => {
    const head = await eventHead();

    const { messages } = await readSse(t.app, `/api/live/events?since=${head - 3}`, { until: untilReady });

    expect(messages.map((m) => Number(m.id))).toEqual([head - 2, head - 1, head, head]);
    expect(messages.at(-1)).toMatchObject({ event: 'ready', data: { cursor: head } });
    for (const message of messages.slice(0, 3)) {
      expect(message.event).toBe(message.data.type);
    }
  });

  it('07 delivers a change as it commits', async () => {
    const table = await t.fixtures.table();
    const head = await eventHead();

    const stream = readSse(t.app, `/api/live/events?since=${head}`, {
      until: (messages) => messages.some((m) => m.event === 'session.opened'),
    });
    await settle();
    await t.fixtures.seat(table.id);
    const { messages } = await stream;

    expect(eventsOf(messages)).toEqual(['ready', 'session.opened']);
    expect(Number(messages[1].id)).toBe(head + 1);
  });

  it('08 resumes from Last-Event-ID rather than since', async () => {
    const head = await eventHead();

    const { messages } = await readSse(t.app, '/api/live/events?since=0', {
      until: untilReady,
      headers: { 'last-event-id': String(head - 1) },
    });

    expect(messages.map((m) => Number(m.id))).toEqual([head, head]);
  });

  it('09 asks a client from the future to resync, and closes', async () => {
    const result = await readSse(t.app, `/api/live/events?since=${(await eventHead()) + 100}`);

    expect(result.messages).toEqual([
      expect.objectContaining({ event: 'resync', data: { reason: 'cursor_unknown' } }),
    ]);
    expect(result.ended).toBe(true);
  });

  it('10 asks a client to resync when the changes it missed are gone', async () => {
    await sql('DELETE FROM "Order_Event" WHERE order_event_id <= 2');

    const result = await readSse(t.app, '/api/live/events?since=0');

    expect(result.messages.at(-1)).toMatchObject({ event: 'resync', data: { reason: 'cursor_expired' } });
    expect(result.ended).toBe(true);
  });

  it("11 shows a guest only their party, and ends when their table is cleared", async () => {
    const [table, elsewhere] = [await t.fixtures.table(), await t.fixtures.table()];
    const guest = await t.fixtures.guest(table.id);
    const head = await eventHead();

    const stream = readSse(t.app, `/api/live/events?since=${head}`, { headers: { cookie: guest.cookie } });
    await settle();
    await t.fixtures.order(elsewhere.id, [food.id]);
    await t.http.post(`/api/table-sessions/${guest.session.id}/close`);
    const result = await stream;

    expect(eventsOf(result.messages)).toEqual(['ready', 'session.closed']);
    expect(result.ended).toBe(true);
  });

  it('12 shows the bar drink items only', async () => {
    const bartender = await t.fixtures.staff('BAR');
    const table = await t.fixtures.table();
    const head = await eventHead();

    const stream = readSse(t.app, `/api/live/events?since=${head}`, {
      headers: { cookie: bartender.cookie },
      until: (messages) => messages.some((m) => m.event === 'item.created'),
    });
    await settle();
    const order = await t.fixtures.order(table.id);
    await t.http.post(`/api/orders/${order.id}/items`, { productId: food.id });
    await t.http.post(`/api/orders/${order.id}/items`, { productId: drink.id });
    const { messages } = await stream;

    // Hidden: session.opened, the empty order.created and the food item.
    expect(eventsOf(messages)).toEqual(['ready', 'item.created']);
    expect(messages[1].data.data.item.product.type).toBe('DRINK');
    expect(Number(messages[1].id)).toBe(head + 4);
  });
});
