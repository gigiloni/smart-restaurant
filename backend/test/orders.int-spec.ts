import { beforeAll, describe, expect, it } from 'vitest';

import { orderSchema, type Order, type Product } from '@smart-restaurant/contracts';

import { useTestApp } from './support/context.js';
import { count, eventHead, eventsAfter, eventTypesAfter, sql } from './support/database.js';

const t = useTestApp();
let food: Product;
let drink: Product;

beforeAll(async () => {
  food = await t.fixtures.product('FOOD');
  drink = await t.fixtures.product('DRINK');
});

describe('I-ORD orders', () => {
  it('01 seats the party with the first order at a free table', async () => {
    const table = await t.fixtures.table();
    const head = await eventHead();

    const response = await t.http.post<Order>('/api/orders', {
      tableId: table.id,
      items: [{ productId: food.id }, { productId: food.id }],
    });

    expect(response.status).toBe(201);
    orderSchema.parse(response.body);
    expect(response.body).toMatchObject({ tableId: table.id, status: 'OPEN', closedAt: null, employeeId: null });
    // Two of a product are two items.
    expect(response.body.orderItems.map((item) => item.status)).toEqual(['OPEN', 'OPEN']);
    expect(await eventTypesAfter(head)).toEqual(['session.opened', 'order.created']);
  });

  it('02 adds further orders to the same party', async () => {
    const table = await t.fixtures.table();

    const first = await t.fixtures.order(table.id);
    const second = await t.fixtures.order(table.id);

    expect(second.tableSessionId).toBe(first.tableSessionId);
  });

  it('03 creates no order when a product is unknown', async () => {
    const table = await t.fixtures.table();
    const before = await count('Order');
    const head = await eventHead();

    const response = await t.http.post('/api/orders', { tableId: table.id, items: [{ productId: 999999 }] });

    expect(response.status).toBe(400);
    expect(await count('Order')).toBe(before);
    expect(await eventTypesAfter(head)).not.toContain('order.created');
  });

  // Current behaviour, not necessarily the desired one: the party is seated in
  // a transaction of its own before the order is attempted.
  it('03b leaves the table occupied after such a failed order', async () => {
    const table = await t.fixtures.table();

    await t.http.post('/api/orders', { tableId: table.id, items: [{ productId: 999999 }] });

    expect((await t.http.post('/api/table-sessions', { tableId: table.id })).status).toBe(200);
  });

  it('04 answers 400 for an unknown table or employee', async () => {
    const table = await t.fixtures.table();

    expect((await t.http.post('/api/orders', { tableId: 999999 })).status).toBe(400);
    expect((await t.http.post('/api/orders', { tableId: table.id, employeeId: 999999 })).status).toBe(400);
  });

  it('05 pages through orders newest first', async () => {
    for (let i = 0; i < 4; i++) await t.fixtures.order((await t.fixtures.table()).id);

    const all = (await t.http.get<Order[]>('/api/orders')).body.map((order) => order.id);
    expect(all).toEqual([...all].sort((a, b) => b - a));

    const page = await t.http.get<Order[]>('/api/orders?take=2&skip=2');
    expect(page.body.map((order) => order.id)).toEqual(all.slice(2, 4));

    for (const query of ['take=201', 'take=0', 'skip=-1']) {
      expect((await t.http.get(`/api/orders?${query}`)).status).toBe(400);
    }
  });

  it('06 returns 50 orders unless asked for another page size', async () => {
    const table = await t.fixtures.table();
    const session = await t.fixtures.seat(table.id);
    await sql(
      `INSERT INTO "Order" (table_session_id, table_id) SELECT $1, $2 FROM generate_series(1, 60)`,
      [session.id, table.id],
    );

    expect((await t.http.get<Order[]>('/api/orders')).body).toHaveLength(50);
    expect((await t.http.get<Order[]>('/api/orders?take=200')).body.length).toBe(await count('Order'));
  });

  it('07 reassigns and unassigns an order', async () => {
    const order = await t.fixtures.order((await t.fixtures.table()).id);
    const { employee } = await t.fixtures.employee('SERVICE');
    const url = `/api/orders/${order.id}`;
    const head = await eventHead();

    const assigned = await t.http.patch<Order>(url, { employeeId: employee.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.employee).toEqual(employee);
    expect((await t.http.patch<Order>(url, { employeeId: null })).body.employeeId).toBeNull();
    expect(await eventTypesAfter(head)).toEqual(['order.updated', 'order.updated']);

    expect((await t.http.patch(url, { employeeId: 999999 })).status).toBe(400);
    expect((await t.http.patch('/api/orders/999999', { employeeId: employee.id })).status).toBe(404);
  });

  it('08 takes payment once everything is served, and freezes the order', async () => {
    const order = await t.fixtures.order((await t.fixtures.table()).id, [food.id, drink.id]);
    const url = `/api/orders/${order.id}`;
    const [item] = order.orderItems;

    const early = await t.http.post(`${url}/close`);
    expect(early.status).toBe(409);
    expect(early.body.message).toContain('still has 2 items that have not been served');

    await t.fixtures.serveAll(order);
    const head = await eventHead();
    const paid = await t.http.post<Order>(`${url}/close`);
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('CLOSED');
    expect(paid.body.closedAt).not.toBeNull();

    const again = await t.http.post<Order>(`${url}/close`);
    expect(again.status).toBe(200);
    expect(again.body.closedAt).toBe(paid.body.closedAt);
    expect(await eventTypesAfter(head)).toEqual(['order.closed']);

    expect((await t.http.patch(url, { employeeId: null })).status).toBe(409);
    expect((await t.http.delete(url)).status).toBe(409);
    expect((await t.http.post(`${url}/items`, { productId: food.id })).status).toBe(409);
    expect((await t.http.patch(`${url}/items/${item.id}`, { status: 'REMAKE' })).status).toBe(409);
    expect((await t.http.delete(`${url}/items/${item.id}`)).status).toBe(409);
  });

  it('09 lets an order without items be closed', async () => {
    const order = await t.fixtures.order((await t.fixtures.table()).id);

    expect((await t.http.post(`/api/orders/${order.id}/close`)).status).toBe(200);
  });

  it('10 cancels an open order with its items', async () => {
    const order = await t.fixtures.order((await t.fixtures.table()).id, [food.id, drink.id]);
    const head = await eventHead();

    const response = await t.http.delete<Order>(`/api/orders/${order.id}`);

    expect(response.status).toBe(200);
    expect(response.body.orderItems).toHaveLength(2);
    expect(await count('Order_Item', 'order_id = $1', [order.id])).toBe(0);
    const [deleted, ...rest] = await eventsAfter(head);
    expect(rest).toEqual([]);
    expect(deleted.type).toBe('order.deleted');
    expect(deleted.payload.order.orderItems).toHaveLength(2);
    expect((await t.http.get(`/api/orders/${order.id}`)).status).toBe(404);
  });

  it('11 assigns a signed-in waiter who names nobody', async () => {
    const table = await t.fixtures.table();
    const waiter = await t.fixtures.staff('SERVICE');
    const admin = await t.fixtures.staff('ADMIN');

    expect((await waiter.api.post<Order>('/api/orders', { tableId: table.id })).body.employeeId).toBe(
      waiter.employee.id,
    );
    expect(
      (await waiter.api.post<Order>('/api/orders', { tableId: table.id, employeeId: null })).body.employeeId,
    ).toBeNull();
    expect((await admin.api.post<Order>('/api/orders', { tableId: table.id })).body.employeeId).toBeNull();
  });
});
