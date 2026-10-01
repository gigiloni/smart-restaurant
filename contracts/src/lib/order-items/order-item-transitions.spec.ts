import { describe, expect, it } from 'vitest';

import type { ProductType } from '../products/product-type.schema.js';
import type { OrderItemStatus } from './order-item-status.schema.js';
import {
  classifyOrderItemTransition,
  permittedOrderItemTargets,
  type OrderItemTransitionKind,
} from './order-item-transitions.js';

const STATUSES: OrderItemStatus[] = ['OPEN', 'IN_PROGRESS', 'READY', 'SERVED', 'REMAKE'];
const PRODUCT_TYPES: ProductType[] = ['FOOD', 'APPETIZER', 'DRINK'];

/**
 * The README's "Order item status" table, typed in independently of the code
 * under test: rows are the current status, columns the requested one. `skip`
 * applies to DRINK only; every other product type gets `null` there.
 */
const README_TABLE: Record<OrderItemStatus, (OrderItemTransitionKind | null)[]> = {
  OPEN: ['unchanged', 'forward', 'skip', 'skip', null],
  IN_PROGRESS: ['undo', 'unchanged', 'forward', 'skip', null],
  READY: [null, 'undo', 'unchanged', 'forward', 'send-back'],
  SERVED: [null, null, 'undo', 'unchanged', 'send-back'],
  REMAKE: [null, 'remake', null, 'keep', 'unchanged'],
};

const cases = PRODUCT_TYPES.flatMap((type) =>
  STATUSES.flatMap((from) =>
    STATUSES.map((to, column) => {
      const cell = README_TABLE[from][column];
      const expected = cell === 'skip' && type !== 'DRINK' ? null : cell;

      return { type, from, to, expected };
    }),
  ),
);

describe('U-CT-01 classifyOrderItemTransition matches the README table', () => {
  it.each(cases)('$type $from -> $to is $expected', ({ type, from, to, expected }) => {
    expect(classifyOrderItemTransition(from, to, type)).toBe(expected);
  });
});

describe('U-CT-02 permittedOrderItemTargets', () => {
  it('lets FOOD only step forward from OPEN', () => {
    expect(permittedOrderItemTargets('OPEN', 'FOOD')).toEqual(['IN_PROGRESS']);
  });

  it('lets DRINK skip ahead from OPEN', () => {
    expect(permittedOrderItemTargets('OPEN', 'DRINK')).toEqual(['IN_PROGRESS', 'READY', 'SERVED']);
  });

  it('allows undo, forward and send-back from READY', () => {
    expect(permittedOrderItemTargets('READY', 'FOOD')).toEqual(['IN_PROGRESS', 'SERVED', 'REMAKE']);
  });

  it('resolves REMAKE to a remake or keep', () => {
    expect(permittedOrderItemTargets('REMAKE', 'DRINK')).toEqual(['IN_PROGRESS', 'SERVED']);
  });

  it.each(STATUSES)('never lists the current status %s as a move', (status) => {
    for (const type of PRODUCT_TYPES) {
      expect(permittedOrderItemTargets(status, type)).not.toContain(status);
    }
  });
});
