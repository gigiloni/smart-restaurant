import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { AccessService } from '../auth/access.service.js';
import type { AuthenticatedEmployee } from '../auth/auth.types.js';
import { RowLocks, type LockedOrder } from '../database/row-locks.js';

/** Who is changing an order, and what they may change. */
export interface OrderChange {
  /**
   * The member of staff making the change, who must own the order unless they
   * are an admin. Omitted for changes that do not depend on ownership, such as
   * moving an item through the kitchen.
   */
  actor?: AuthenticatedEmployee;

  /** Let a closed order through: paying for it again is a no-op, not a conflict. */
  allowClosed?: boolean;
}

/**
 * Locks an order for a change and checks, under that lock, that the change may
 * happen: the order exists (404), belongs to the actor (403) and is still open
 * (409). Checking after locking means none of it can change before the write:
 * the order cannot be paid, reassigned or deleted in between.
 */
@Injectable()
export class OrderLock {
  constructor(
    private readonly locks: RowLocks,
    private readonly access: AccessService,
  ) {}

  async forChange(id: number, change: OrderChange = {}): Promise<LockedOrder> {
    const order = await this.locks.order(id);

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    if (change.actor) {
      this.access.requireOrderOwner(change.actor, order);
    }

    if (order.status === 'CLOSED' && !change.allowClosed) {
      throw new ConflictException(
        `Order ${id} is closed: it has been paid and can no longer be changed`,
      );
    }

    return order;
  }
}
