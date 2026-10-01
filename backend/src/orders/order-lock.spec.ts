import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { stub } from '../../test/support/unit.js';
import { AccessService } from '../auth/access.service.js';
import type { LockedOrder, RowLocks } from '../database/row-locks.js';
import { OrderLock } from './order-lock.js';

const open: LockedOrder = { id: 1, status: 'OPEN', tableSessionId: 2, employeeId: 5 };
const lock = (row: LockedOrder | null) =>
  new OrderLock(stub<RowLocks>({ order: vi.fn().mockResolvedValue(row) }), new AccessService());

describe('U-SV-LCK OrderLock.forChange', () => {
  it('01 answers 404 for an unknown order', async () => {
    await expect(lock(null).forChange(1)).rejects.toThrow(NotFoundException);
  });

  it("02 hides another party's order from a guest (404, not 403)", async () => {
    await expect(lock(open).forChange(1, { tableSessionId: 3 })).rejects.toThrow(NotFoundException);
  });

  it('03 forbids a waiter who does not own the order', async () => {
    await expect(lock(open).forChange(1, { actor: { id: 6, role: 'SERVICE' } })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('04 refuses changes to a paid order', async () => {
    await expect(lock({ ...open, status: 'CLOSED' }).forChange(1)).rejects.toThrow(ConflictException);
  });

  it('05 lets a paid order through when asked to', async () => {
    await expect(
      lock({ ...open, status: 'CLOSED' }).forChange(1, { allowClosed: true }),
    ).resolves.toMatchObject({ status: 'CLOSED' });
  });

  it('06 checks ownership before the order status', async () => {
    await expect(
      lock({ ...open, status: 'CLOSED' }).forChange(1, { actor: { id: 6, role: 'SERVICE' } }),
    ).rejects.toThrow(ForbiddenException);
  });
});
