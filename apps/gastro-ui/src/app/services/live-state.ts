import type { LiveSnapshot, OrderEvent, EmployeeRole } from '@smart-restaurant/contracts';

export interface LiveState extends LiveSnapshot {
  needsSnapshot: boolean;
}
export const emptyLiveState = (): LiveState => ({
  cursor: 0,
  sessions: [],
  orders: [],
  ingredients: [],
  needsSnapshot: false,
});

export function applyLiveEvent(
  state: LiveState,
  event: OrderEvent,
  role?: EmployeeRole,
): LiveState {
  if (event.id <= state.cursor) return state;
  const next: LiveState = {
    ...state,
    cursor: event.id,
    sessions: [...state.sessions],
    orders: [...state.orders],
  };
  const station = role === 'KITCHEN' || role === 'BAR';
  const upsert = <T extends { id: number }>(list: T[], value: T): T[] =>
    [...list.filter((item) => item.id !== value.id), value].sort((a, b) => a.id - b.id);
  switch (event.type) {
    case 'inventory.updated':
      next.ingredients = event.data.ingredient
        ? upsert(next.ingredients ?? [], event.data.ingredient)
        : (next.ingredients ?? []).filter(
            (ingredient) => ingredient.id !== event.data.ingredientId,
          );
      break;
    case 'session.opened':
      next.sessions = upsert(next.sessions, event.data.session);
      break;
    case 'session.moved': {
      const session = event.data.session;
      next.sessions = upsert(next.sessions, session);
      next.orders = next.orders.map((order) =>
        order.tableSessionId === session.id
          ? { ...order, tableId: session.tableId, table: session.table }
          : order,
      );
      break;
    }
    case 'session.closed':
      next.sessions = next.sessions.filter((session) => session.id !== event.data.session.id);
      next.orders = next.orders.filter((order) => order.tableSessionId !== event.data.session.id);
      break;
    case 'order.created':
    case 'order.updated':
    case 'order.closed':
      next.orders = upsert(next.orders, event.data.order);
      break;
    case 'order.deleted':
      next.orders = next.orders.filter((order) => order.id !== event.data.order.id);
      break;
    case 'item.created':
    case 'item.status_changed':
    case 'item.deleted': {
      const { item, order: reference } = event.data;
      if (!next.orders.some((order) => order.id === reference.id)) {
        if (event.type !== 'item.deleted') next.needsSnapshot = true;
        break;
      }
      next.orders = next.orders.map((order) =>
        order.id !== reference.id
          ? order
          : {
              ...order,
              orderItems:
                event.type === 'item.deleted'
                  ? order.orderItems.filter((entry) => entry.id !== item.id)
                  : upsert(order.orderItems, item),
            },
      );
      break;
    }
  }
  if (station) {
    next.orders = next.orders.filter(
      (order) => order.status === 'OPEN' && order.orderItems.length > 0,
    );
    next.sessions = next.sessions.filter((session) =>
      next.orders.some((order) => order.tableSessionId === session.id),
    );
  }
  return next;
}
