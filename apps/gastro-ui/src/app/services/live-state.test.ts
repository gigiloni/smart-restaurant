import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order, OrderEvent, TableSession } from '@smart-restaurant/contracts';
import { applyLiveEvent, emptyLiveState } from './live-state.ts';

const table = { id: 1, tableNumber: 1, seats: 2 };
const session: TableSession = {
  id: 8,
  tableId: 1,
  table,
  openedAt: '2026-10-05T12:00:00Z',
  closedAt: null,
};
const order: Order = {
  id: 3,
  tableSessionId: 8,
  tableId: 1,
  table,
  employeeId: null,
  employee: null,
  status: 'OPEN',
  closedAt: null,
  orderItems: [],
};
const event = (id: number, type: string, data: unknown) =>
  ({ id, type, data, occurredAt: '2026-10-05T12:00:00Z' }) as OrderEvent;

test('SSE duplicate/older events are ignored, scoped cursor gaps are accepted', () => {
  const initial = { ...emptyLiveState(), cursor: 20, orders: [order] };
  assert.equal(applyLiveEvent(initial, event(20, 'order.deleted', { order })), initial);
  const changed = applyLiveEvent(
    initial,
    event(27, 'order.updated', { order: { ...order, employeeId: 5 } }),
  );
  assert.equal(changed.cursor, 27);
  assert.equal(changed.orders[0].employeeId, 5);
  assert.equal(initial.orders[0].employeeId, null);
});
test('moving a visit carries paid and open orders; closing it clears only that visit', () => {
  const initial = {
    ...emptyLiveState(),
    sessions: [session],
    orders: [
      order,
      { ...order, id: 4, status: 'CLOSED' as const },
      { ...order, id: 5, tableSessionId: 9 },
    ],
  };
  const moved = applyLiveEvent(
    initial,
    event(1, 'session.moved', {
      session: { ...session, tableId: 2, table: { ...table, id: 2, tableNumber: 7 } },
      previousTableId: 1,
    }),
  );
  assert.deepEqual(
    moved.orders.map((order) => order.tableId),
    [2, 2, 1],
  );
  const closed = applyLiveEvent(moved, event(2, 'session.closed', { session }));
  assert.deepEqual(
    closed.orders.map((order) => order.id),
    [5],
  );
  assert.equal(closed.sessions.length, 0);
});
test('a new station item without a known order requests a fresh snapshot', () => {
  const item = {
    id: 2,
    orderId: 3,
    productId: 1,
    status: 'OPEN',
    product: { id: 1, name: 'Pasta', type: 'FOOD', price: '12.00', description: null },
  };
  const next = applyLiveEvent(
    emptyLiveState(),
    event(1, 'item.created', {
      item,
      order: { id: 3, tableSessionId: 8, tableId: 1, tableNumber: 1, status: 'OPEN' },
    }),
    'KITCHEN',
  );
  assert.equal(next.needsSnapshot, true);
  assert.equal(next.orders.length, 0);
});
test('station removes paid tickets while guest keeps them', () => {
  const item = {
    id: 2,
    orderId: 3,
    productId: 1,
    status: 'SERVED' as const,
    product: { id: 1, name: 'Pasta', type: 'FOOD' as const, price: '12.00', description: null },
  };
  const initial = {
    ...emptyLiveState(),
    sessions: [session],
    orders: [{ ...order, orderItems: [item] }],
  };
  const closed = event(1, 'order.closed', {
    order: { ...order, orderItems: [item], status: 'CLOSED' },
  });
  assert.equal(applyLiveEvent(initial, closed, 'KITCHEN').orders.length, 0);
  assert.equal(applyLiveEvent(initial, closed).orders.length, 1);
});
test('inventory changes use the same stream without discarding open orders', () => {
  const initial = { ...emptyLiveState(), orders: [order] };
  const changed = applyLiveEvent(
    initial,
    event(1, 'inventory.updated', {
      ingredientId: 7,
      ingredient: { id: 7, name: 'Flour', unit: 'g', stock: 500 },
    }),
  );
  assert.equal(changed.ingredients?.[0].stock, 500);
  assert.equal(changed.orders.length, 1);
  assert.equal(
    applyLiveEvent(changed, event(2, 'inventory.updated', { ingredientId: 7, ingredient: null }))
      .ingredients?.length,
    0,
  );
});
