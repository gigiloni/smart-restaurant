import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { EmployeeRole, OrderItemStatus, ProductType } from '@smart-restaurant/contracts';

import { AccessService } from './access.service.js';

// Dormant while access control is switched off, but kept: these are the rules
// the README documents for when it is switched back on.
const access = new AccessService();
const as = (role: EmployeeRole, id = 7) => ({ id, role });

describe('U-AC-01 requireAdmin', () => {
  it('lets admins through', () => {
    expect(() => access.requireAdmin(as('ADMIN'))).not.toThrow();
  });

  it.each(['SERVICE', 'KITCHEN', 'BAR'] as const)('forbids %s', (role) => {
    expect(() => access.requireAdmin(as(role))).toThrow(ForbiddenException);
  });
});

describe('U-AC-02 requireEmployee', () => {
  it('allows the own profile and admins, forbids others', () => {
    expect(() => access.requireEmployee(as('BAR', 7), 7)).not.toThrow();
    expect(() => access.requireEmployee(as('ADMIN', 1), 8)).not.toThrow();
    expect(() => access.requireEmployee(as('BAR', 7), 8)).toThrow(ForbiddenException);
  });
});

describe('U-AC-03 requireEmployeeUpdate', () => {
  it('lets staff edit their profile but not their role', () => {
    expect(() => access.requireEmployeeUpdate(as('SERVICE', 7), 7)).not.toThrow();
    expect(() => access.requireEmployeeUpdate(as('SERVICE', 7), 7, 'ADMIN')).toThrow(
      'Only admins can assign roles',
    );
    expect(() => access.requireEmployeeUpdate(as('ADMIN', 1), 7, 'BAR')).not.toThrow();
  });
});

describe('U-AC-04 requireService', () => {
  it('allows SERVICE and ADMIN only', () => {
    expect(() => access.requireService(as('SERVICE'))).not.toThrow();
    expect(() => access.requireService(as('ADMIN'))).not.toThrow();
    expect(() => access.requireService(as('KITCHEN'))).toThrow(ForbiddenException);
    expect(() => access.requireService(as('BAR'))).toThrow(ForbiddenException);
  });
});

describe('U-AC-05 requireOrderOwner', () => {
  it('lets any waiter look after an unassigned order', () => {
    expect(() => access.requireOrderOwner(as('SERVICE', 7), { employeeId: null })).not.toThrow();
  });

  it('keeps an assigned order to its waiter and admins', () => {
    expect(() => access.requireOrderOwner(as('SERVICE', 7), { employeeId: 7 })).not.toThrow();
    expect(() => access.requireOrderOwner(as('ADMIN', 1), { employeeId: 8 })).not.toThrow();
    expect(() => access.requireOrderOwner(as('SERVICE', 7), { employeeId: 8 })).toThrow(
      'Only the assigned employee',
    );
  });

  it('never lets kitchen or bar own an order', () => {
    expect(() => access.requireOrderOwner(as('KITCHEN'), { employeeId: null })).toThrow(
      'Service role required',
    );
  });
});

/** The README role table, written out independently of the implementation. */
function readmeAllows(role: EmployeeRole, type: ProductType, status: OrderItemStatus): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'SERVICE') return status === 'SERVED' || status === 'REMAKE';

  const preparation = status === 'OPEN' || status === 'IN_PROGRESS' || status === 'READY';

  return (
    preparation &&
    ((role === 'KITCHEN' && (type === 'FOOD' || type === 'APPETIZER')) ||
      (role === 'BAR' && type === 'DRINK'))
  );
}

const statusCases = (['ADMIN', 'SERVICE', 'KITCHEN', 'BAR'] as const).flatMap((role) =>
  (['FOOD', 'APPETIZER', 'DRINK'] as const).flatMap((type) =>
    (['OPEN', 'IN_PROGRESS', 'READY', 'SERVED', 'REMAKE'] as const).map((status) => ({
      role,
      type,
      status,
      allowed: readmeAllows(role, type, status),
    })),
  ),
);

describe('U-AC-06 requireStatusChange', () => {
  it.each(statusCases)('$role sets $type to $status: $allowed', ({ role, type, status, allowed }) => {
    const change = () => access.requireStatusChange(as(role), type, status);

    if (allowed) {
      expect(change).not.toThrow();
    } else {
      expect(change).toThrow(ForbiddenException);
    }
  });
});
