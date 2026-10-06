import { beforeAll, describe, expect, it } from 'vitest';

import type { Order, OrderItem, OrderItemStatus, Product } from '@smart-restaurant/contracts';

import { useTestApp } from './support/context.js';
import { eventHead, eventsAfter, eventTypesAfter } from './support/database.js';

const t = useTestApp();
let food: Product;
let drink: Product;

beforeAll(async () => {
  food = await t.fixtures.product('FOOD');
  drink = await t.fixtures.product('DRINK');
});

const move = (order: Order, item: OrderItem, status: OrderItemStatus) =>
  t.http.patch(`/api/orders/${order.id}/items/${item.id}`, { status });

describe('I-ITM order items', () => {
  it("01 adds items and keeps them to their own order", async () => {
    const table = await t.fixtures.table();
    const order = await t.fixtures.order(table.id, [food.id]);
    const other = await t.fixtures.order(table.id, [food.id]);
    const head = await eventHead();

    const added = await t.http.post<OrderItem>(`/api/orders/${order.id}/items`, { productId: drink.id });
    expect(added.status).toBe(201);
    expect(added.body.status).toBe('OPEN');
    expect(await eventTypesAfter(head)).toEqual(['item.created']);

    const list = await t.http.get<OrderItem[]>(`/api/orders/${order.id}/items`);
    expect(list.body.map((item) => item.id)).toEqual([order.orderItems[0].id, added.body.id]);

    const foreign = `/api/orders/${order.id}/items/${other.orderItems[0].id}`;
    expect((await t.http.get(foreign)).status).toBe(404);
    expect((await t.http.patch(foreign, { status: 'IN_PROGRESS' })).status).toBe(404);
    expect((await t.http.delete(foreign)).status).toBe(404);
  });

  it('02 answers 400 for an unknown product and 404 for an unknown order', async () => {
    const order = await t.fixtures.order((await t.fixtures.table()).id);

    expect((await t.http.post(`/api/orders/${order.id}/items`, { productId: 999999 })).status).toBe(400);
    expect((await t.http.post('/api/orders/999999/items', { productId: food.id })).status).toBe(404);
    expect((await t.http.get('/api/orders/999999/items')).status).toBe(404);
  });

  it('03 enforces the status rules', async () => {
    const order = await t.fixtures.order((await t.fixtures.table()).id, [food.id, drink.id]);
    const [dish, bottle] = order.orderItems;

    const skip = await move(order, dish, 'READY');
    expect(skip.status).toBe(409);
    expect(skip.body.message).toContain('only DRINK items may skip ahead');

    expect((await move(order, bottle, 'SERVED')).status).toBe(200);
    const rewind = await move(order, bottle, 'IN_PROGRESS');
    expect(rewind.status).toBe(409);
    expect(rewind.body.message).toContain('Permitted from SERVED: READY, REMAKE');

    expect((await move(order, dish, 'IN_PROGRESS')).status).toBe(200);
    expect((await move(order, dish, 'REMAKE')).status).toBe(409);
  });

  it('04 accepts a repeated status silently and records real moves in full', async () => {
    const table = await t.fixtures.table();
    const order = await t.fixtures.order(table.id, [food.id]);
    const [item] = order.orderItems;
    const head = await eventHead();

    expect((await move(order, item, 'OPEN')).status).toBe(200);
    expect(await eventHead()).toBe(head);

    await move(order, item, 'IN_PROGRESS');
    const [event] = await eventsAfter(head);
    expect(event).toMatchObject({ type: 'item.status_changed', productType: 'FOOD', orderItemId: item.id });
    expect(event.payload.previousStatus).toBe('OPEN');
    expect(event.payload.order).toEqual({
      id: order.id,
      tableSessionId: order.tableSessionId,
      tableId: table.id,
      tableNumber: table.tableNumber,
      status: 'OPEN',
    });
  });

  it('05 sends items back and resolves the remake either way', async () => {
    const order = await t.fixtures.order((await t.fixtures.table()).id, [food.id, food.id]);
    const [remade, kept] = order.orderItems;

    for (const status of ['IN_PROGRESS', 'READY', 'REMAKE', 'IN_PROGRESS', 'READY', 'SERVED'] as const) {
      expect((await move(order, remade, status)).status).toBe(200);
    }
    for (const status of ['IN_PROGRESS', 'READY', 'SERVED', 'REMAKE', 'SERVED'] as const) {
      expect((await move(order, kept, status)).status).toBe(200);
    }
  });

  it('06 does not take payment while an item is being remade', async () => {
    const order = await t.fixtures.order((await t.fixtures.table()).id, [drink.id]);
    const [item] = order.orderItems;
    expect((await move(order, item, 'SERVED')).status).toBe(200);
    expect((await move(order, item, 'REMAKE')).status).toBe(200);

    const payment = await t.http.post(`/api/orders/${order.id}/close`);
    expect(payment.status).toBe(409);
    expect(payment.body.message).toContain('still has 1 item that has not been served');
  });

  it('07 removes an item', async () => {
    const order = await t.fixtures.order((await t.fixtures.table()).id, [food.id]);
    const url = `/api/orders/${order.id}/items/${order.orderItems[0].id}`;
    const head = await eventHead();

    expect((await t.http.delete(url)).status).toBe(200);
    expect(await eventTypesAfter(head)).toEqual(['item.deleted']);
    expect((await t.http.get(url)).status).toBe(404);
  });

  it('08 always creates items as OPEN', async () => {
    const order = await t.fixtures.order((await t.fixtures.table()).id);

    const response = await t.http.post<OrderItem>(`/api/orders/${order.id}/items`, {
      productId: food.id,
      status: 'SERVED',
    });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('OPEN');
  });
});
