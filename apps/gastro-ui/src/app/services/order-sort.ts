import type { Order } from '@smart-restaurant/contracts';

export type OrderSort = 'newest' | 'oldest' | 'table' | 'status' | 'total';
export const orderSortOptions = [
  { label: 'Neueste zuerst', value: 'newest' },
  { label: 'Älteste zuerst', value: 'oldest' },
  { label: 'Tischnummer', value: 'table' },
  { label: 'Unbezahlt zuerst', value: 'status' },
  { label: 'Höchster Betrag', value: 'total' },
];
export function sortOrders(orders: readonly Order[], sort: OrderSort): Order[] {
  const total = (order: Order) =>
    order.orderItems.reduce((sum, item) => sum + Math.round(Number(item.product.price) * 100), 0);
  return [...orders].sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return a.id - b.id;
      case 'table':
        return a.table.tableNumber - b.table.tableNumber || b.id - a.id;
      case 'status':
        return Number(a.status === 'CLOSED') - Number(b.status === 'CLOSED') || a.id - b.id;
      case 'total':
        return total(b) - total(a) || b.id - a.id;
      default:
        return b.id - a.id;
    }
  });
}
