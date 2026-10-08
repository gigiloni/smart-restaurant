import { describe, expect, it } from 'vitest';

import type { EmployeeRole, OrderEventType, ProductType } from '@smart-restaurant/contracts';

import type { Viewer } from '../auth/viewer.types.js';
import { onlyStationItems, scopeEvent, stationProductTypes } from './live-scope.js';
import type { LoggedOrderEvent } from './order-event-log.js';

const itemOf = (type: ProductType) => ({ product: { type } });

/** A logged event with just the fields scoping reads. */
function logged(
  type: OrderEventType,
  options: { session?: number; productType?: ProductType; items?: ProductType[]; productTypes?: ProductType[] } = {},
): LoggedOrderEvent {
  const items = options.items ?? ['FOOD', 'DRINK'];
  const data = type.startsWith('order.')
    ? { order: { id: 1, employeeId: 3, employee: { id: 3 }, orderItems: items.map(itemOf) } }
    : type.startsWith('item.')
      ? { item: itemOf(options.productType ?? 'FOOD'), order: {} }
      : { session: { id: options.session ?? 2 } };

  return {
    event: { id: 1, occurredAt: '2026-10-01T00:00:00.000Z', type, data } as LoggedOrderEvent['event'],
    tableSessionId: options.session ?? 2,
    productType: options.productType ?? null,
    productTypes: options.productTypes ?? items,
  };
}

const staff = (role: EmployeeRole): Viewer => ({ kind: 'staff', employeeId: 1, role });
const guest = (tableSessionId = 2): Viewer => ({ kind: 'guest', tableSessionId, tableId: 1 });
const orderOf = (scoped: unknown) =>
  (scoped as { data: { order: { employeeId: number | null; employee: unknown; orderItems: unknown[] } } })
    .data.order;

describe('U-LS-01 stationProductTypes', () => {
  it('limits kitchen and bar to their products', () => {
    expect(stationProductTypes(staff('KITCHEN'))).toEqual(['APPETIZER', 'FOOD']);
    expect(stationProductTypes(staff('BAR'))).toEqual(['DRINK']);
  });

  it('does not limit anyone else by product type', () => {
    for (const viewer of [staff('SERVICE'), staff('ADMIN'), guest(), undefined]) {
      expect(stationProductTypes(viewer)).toBeNull();
    }
  });
});

describe('U-LS-02..05 everyone but the stations', () => {
  it('shows anonymous callers, service and admin every event unchanged', () => {
    for (const viewer of [undefined, staff('SERVICE'), staff('ADMIN')]) {
      for (const type of ['session.opened', 'order.created', 'item.created'] as const) {
        const event = logged(type);
        expect(scopeEvent(viewer, event)).toBe(event.event);
      }
    }
  });

  it('shows a guest their own session only', () => {
    expect(scopeEvent(guest(2), logged('item.created', { session: 2 }))).not.toBeNull();
    expect(scopeEvent(guest(2), logged('item.created', { session: 3 }))).toBeNull();
  });

  it.each(['order.created', 'order.updated', 'order.closed', 'order.deleted'] as const)('never tells a guest who served them (%s)', (type) => {
    const order = orderOf(scopeEvent(guest(2), logged(type)));

    expect(order.employeeId).toBeNull();
    expect(order.employee).toBeNull();
  });

  it('tells a guest their table was cleared', () => {
    expect(scopeEvent(guest(2), logged('session.closed'))).not.toBeNull();
  });
});

describe('U-LS-06..08 kitchen and bar', () => {
  it('route item events by product type', () => {
    expect(scopeEvent(staff('KITCHEN'), logged('item.created', { productType: 'APPETIZER' }))).not.toBeNull();
    expect(scopeEvent(staff('KITCHEN'), logged('item.created', { productType: 'DRINK' }))).toBeNull();
    expect(scopeEvent(staff('BAR'), logged('item.status_changed', { productType: 'DRINK' }))).not.toBeNull();
  });

  it.each(['order.created', 'order.updated', 'order.closed', 'order.deleted'] as const)('see orders with their items only (%s)', (type) => {
    const order = orderOf(scopeEvent(staff('KITCHEN'), logged(type, { items: ['FOOD', 'DRINK'] })));

    expect(order.orderItems).toEqual([itemOf('FOOD')]);
    expect(scopeEvent(staff('KITCHEN'), logged(type, { items: ['DRINK'] }))).toBeNull();
  });

  it('never see tables opened or cleared, and moves only when they matter', () => {
    for (const role of ['KITCHEN', 'BAR'] as const) {
      expect(scopeEvent(staff(role), logged('session.opened'))).toBeNull();
      expect(scopeEvent(staff(role), logged('session.closed'))).toBeNull();
    }

    expect(scopeEvent(staff('BAR'), logged('session.moved', { productTypes: ['FOOD'] }))).toBeNull();
    expect(scopeEvent(staff('BAR'), logged('session.moved', { productTypes: ['DRINK'] }))).not.toBeNull();
  });
});

describe('U-LS-09..10 purity', () => {
  it('never changes the logged event, which every client shares', () => {
    const event = logged('order.created');

    scopeEvent(staff('KITCHEN'), event);
    scopeEvent(guest(), event);

    expect(orderOf(event.event).orderItems).toHaveLength(2);
    expect(orderOf(event.event).employeeId).toBe(3);
  });

  it('onlyStationItems keeps the station items', () => {
    const order = { orderItems: (['FOOD', 'DRINK', 'APPETIZER'] as const).map(itemOf) };

    expect(onlyStationItems(order, ['DRINK']).orderItems).toEqual([itemOf('DRINK')]);
  });
});
