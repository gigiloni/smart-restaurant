import { ConflictException, NotFoundException } from '@nestjs/common';

import type { LockedOrder } from '../database/row-locks.js';

/**
 * A closed order has been paid and is frozen. Anything that would change it or
 * its items goes through here, with the order's row lock already held so the
 * status cannot change between this check and the write.
 */
export function requireOpenOrder(order: LockedOrder | null, id: number): LockedOrder {
  if (!order) {
    throw new NotFoundException(`Order ${id} not found`);
  }

  if (order.status === 'CLOSED') {
    throw new ConflictException(
      `Order ${id} is closed: it has been paid and can no longer be changed`,
    );
  }

  return order;
}
