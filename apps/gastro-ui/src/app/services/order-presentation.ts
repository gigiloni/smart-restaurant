import type { Order } from '@smart-restaurant/contracts';
import { priceInCents } from './cart-state';
export const statusLabels = {
  OPEN: 'Aufgenommen',
  IN_PROGRESS: 'In Zubereitung',
  READY: 'Bereit zum Servieren',
  SERVED: 'Serviert',
  REMAKE: 'Neuzubereitung',
};
export const orderTotal = (order: Order): number =>
  order.orderItems.reduce((sum, item) => sum + priceInCents(item.product.price), 0);
