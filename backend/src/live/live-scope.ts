import type { EmployeeRole, OrderEvent, ProductType } from '@smart-restaurant/contracts';

import type { Viewer } from '../auth/viewer.types.js';
import type { LoggedOrderEvent } from './order-event-log.js';

/**
 * The product types each preparing station works on. Roles not listed here see
 * every product type.
 */
const STATION_PRODUCT_TYPES: Partial<Record<EmployeeRole, readonly ProductType[]>> = {
  KITCHEN: ['APPETIZER', 'FOOD'],
  BAR: ['DRINK'],
};

/**
 * The product types the viewer is limited to, or null when they see
 * everything. Guests are limited by table session instead.
 */
export function stationProductTypes(viewer: Viewer): readonly ProductType[] | null {
  return viewer.kind === 'staff' ? (STATION_PRODUCT_TYPES[viewer.role] ?? null) : null;
}

/**
 * The event as this viewer may see it, or null if they may not see it at all.
 *
 * - Service and admin see everything.
 * - Kitchen and bar see item events for their product types, and order and
 *   move events for orders holding at least one such item, with the other
 *   items taken out. Opening and clearing tables is none of their business.
 * - Guests see everything about their own table session, minus who served
 *   them.
 */
export function scopeEvent(viewer: Viewer, logged: LoggedOrderEvent): OrderEvent | null {
  const { event } = logged;

  if (viewer.kind === 'guest') {
    return logged.tableSessionId === viewer.tableSessionId ? withoutEmployee(event) : null;
  }

  const station = stationProductTypes(viewer);

  if (!station) {
    return event;
  }

  switch (event.type) {
    case 'item.created':
    case 'item.status_changed':
    case 'item.deleted':
      return logged.productType && station.includes(logged.productType) ? event : null;

    case 'order.created':
    case 'order.updated':
    case 'order.closed':
    case 'order.deleted':
      return logged.productTypes.some((type) => station.includes(type))
        ? { ...event, data: { ...event.data, order: onlyStationItems(event.data.order, station) } }
        : null;

    case 'session.moved':
      return logged.productTypes.some((type) => station.includes(type)) ? event : null;

    case 'session.opened':
    case 'session.closed':
      return null;
  }
}

interface StationOrder {
  orderItems: { product: { type: ProductType } }[];
}

/** The order as a station sees it: only the items it prepares. */
export function onlyStationItems<T extends StationOrder>(
  order: T,
  station: readonly ProductType[],
): T {
  return {
    ...order,
    orderItems: order.orderItems.filter((item) => station.includes(item.product.type)),
  };
}

/** The order as a guest sees it: without the employee who took it. */
export function orderForGuest<T extends { employeeId: number | null; employee: object | null }>(
  order: T,
): T {
  return { ...order, employeeId: null, employee: null } as T;
}

function withoutEmployee(event: OrderEvent): OrderEvent {
  switch (event.type) {
    case 'order.created':
    case 'order.updated':
    case 'order.closed':
    case 'order.deleted':
      return { ...event, data: { ...event.data, order: orderForGuest(event.data.order) } };

    default:
      return event;
  }
}
