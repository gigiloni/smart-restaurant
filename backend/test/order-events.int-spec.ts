import { beforeAll, describe, expect, it } from 'vitest';

import { orderEventSchema, type Product } from '@smart-restaurant/contracts';

import { useTestApp } from './support/context.js';
import { eventHead, eventsAfter } from './support/database.js';

const t = useTestApp();
let food: Product;
let drink: Product;

beforeAll(async () => {
  food = await t.fixtures.product('FOOD');
  drink = await t.fixtures.product('DRINK');
});

describe('I-EVT order events', () => {
  it('01 stores every change as a valid event with gap-free ids', async () => {
    const head = await eventHead();
    const [table, target] = [await t.fixtures.table(), await t.fixtures.table()];
    const order = await t.fixtures.order(table.id, [food.id, drink.id]);
    await t.http.post(`/api/orders/${order.id}/items`, { productId: drink.id });
    const { employee } = await t.fixtures.employee('SERVICE');
    await t.http.patch(`/api/orders/${order.id}`, { employeeId: employee.id });
    await t.http.patch(`/api/table-sessions/${order.tableSessionId}`, { tableId: target.id });
    const paid = await t.fixtures.pay((await t.http.get(`/api/orders/${order.id}`)).body);
    await t.http.post(`/api/table-sessions/${paid.tableSessionId}/close`);
    const doomed = await t.fixtures.order(table.id, [food.id]);
    await t.http.delete(`/api/orders/${doomed.id}/items/${doomed.orderItems[0].id}`);
    await t.http.delete(`/api/orders/${doomed.id}`);

    const events = await eventsAfter(head);

    expect(new Set(events.map((e) => e.type))).toEqual(
      new Set([
        'session.opened', 'session.moved', 'session.closed',
        'order.created', 'order.updated', 'order.closed', 'order.deleted',
        'item.created', 'item.status_changed', 'item.deleted',
      ]),
    );
    expect(events.map((e) => e.id)).toEqual(events.map((_, i) => head + i + 1));
    expect(await eventHead()).toBe(head + events.length);
    // Events are replayed to every client: no login ids in them.
    expect(JSON.stringify(events)).not.toContain('authUserId');
    for (const event of events) {
      orderEventSchema.parse({
        id: event.id,
        occurredAt: event.occurredAt.toISOString(),
        type: event.type,
        data: event.payload,
      });
    }
  });

  it('02 writes nothing for a request that fails', async () => {
    const order = await t.fixtures.order((await t.fixtures.table()).id, [food.id]);
    const head = await eventHead();

    // Each of these must fail for its documented reason, and write nothing.
    expect((await t.http.post(`/api/orders/${order.id}/close`)).status).toBe(409);
    expect(
      (await t.http.patch(`/api/orders/${order.id}/items/${order.orderItems[0].id}`, { status: 'SERVED' })).status,
    ).toBe(409);
    expect((await t.http.post(`/api/table-sessions/${order.tableSessionId}/close`)).status).toBe(409);
    expect((await t.http.post(`/api/orders/${order.id}/items`, { productId: 999999 })).status).toBe(400);

    expect(await eventHead()).toBe(head);
  });

  it('03 records which product types an order holds, for routing to kitchen and bar', async () => {
    const head = await eventHead();

    await t.fixtures.order((await t.fixtures.table()).id, [food.id, drink.id, food.id]);

    const created = (await eventsAfter(head)).find((e) => e.type === 'order.created');
    expect(created?.productTypes.sort()).toEqual(['DRINK', 'FOOD']);
  });
});
