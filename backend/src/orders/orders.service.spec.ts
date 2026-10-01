import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { prismaError, withTransactions } from '../../test/support/unit.js';
import type { GuestViewer } from '../auth/viewer.types.js';
import { RowLocks } from '../database/row-locks.js';
import { OrderEventsWriter } from '../order-events/order-events.writer.js';
import { TableSessionsService } from '../table-sessions/table-sessions.service.js';
import { OrderLock } from './order-lock.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';

interface Collaborators {
  locks?: object;
  orderLock?: object;
  events?: object;
  repository?: object;
  sessions?: object;
}

const service = (c: Collaborators = {}) =>
  withTransactions(OrdersService, [
    { provide: RowLocks, useValue: c.locks ?? {} },
    { provide: OrderLock, useValue: c.orderLock ?? {} },
    { provide: OrderEventsWriter, useValue: c.events ?? {} },
    { provide: OrdersRepository, useValue: c.repository ?? {} },
    { provide: TableSessionsService, useValue: c.sessions ?? {} },
  ]);

const order = (overrides: object = {}) => ({
  id: 1,
  tableSessionId: 2,
  tableId: 3,
  status: 'OPEN',
  employeeId: null,
  orderItems: [],
  ...overrides,
});
const session = (closed = false, tableId = 3, id = 2) => ({
  id,
  tableId,
  closedAt: closed ? new Date() : null,
});
const guest: GuestViewer = { kind: 'guest', tableSessionId: 2, tableId: 3 };
const oneItem = [{ productId: 1 }];

describe('U-SV-ORD-01..05 guest orders', () => {
  it('01 refuses to let a guest assign an employee', async () => {
    const orders = await service();

    await expect(
      orders.createForGuest(guest, { tableId: 3, employeeId: 1, items: oneItem }),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([undefined, []])('02 needs at least one item (items: %j)', async (items) => {
    const orders = await service();

    await expect(orders.createForGuest(guest, { tableId: 3, items })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('03 tells a moved party where they are seated now', async () => {
    const orders = await service({
      locks: { tableSession: vi.fn().mockResolvedValue(session(false, 4)) },
      repository: { tableNumberOf: vi.fn().mockResolvedValue(12), create: vi.fn() },
    });

    await expect(orders.createForGuest(guest, { tableId: 3, items: oneItem })).rejects.toThrow(
      'seated at table 12 (id 4)',
    );
  });

  it('04 refuses an order once the table is cleared', async () => {
    const orders = await service({ locks: { tableSession: vi.fn().mockResolvedValue(session(true)) } });

    await expect(orders.createForGuest(guest, { tableId: 3, items: oneItem })).rejects.toThrow(
      'has been cleared',
    );
  });

  it("05 places an unassigned order in the guest's session and records it", async () => {
    const created = order();
    const create = vi.fn().mockResolvedValue(created);
    const orderCreated = vi.fn();
    const orders = await service({
      locks: { tableSession: vi.fn().mockResolvedValue(session()) },
      repository: { create },
      events: { orderCreated },
    });

    await expect(orders.createForGuest(guest, { tableId: 3, items: oneItem })).resolves.toBe(created);
    expect(create).toHaveBeenCalledWith({
      employeeId: null,
      items: oneItem,
      tableSessionId: 2,
      tableId: 3,
    });
    expect(orderCreated).toHaveBeenCalledWith(created);
  });
});

describe('U-SV-ORD-06..08 staff orders', () => {
  it('06 seats the next party when the table is cleared in between', async () => {
    const openOrJoin = vi
      .fn()
      .mockResolvedValueOnce({ session: { id: 1 } })
      .mockResolvedValueOnce({ session: { id: 9 } });
    const orders = await service({
      sessions: { openOrJoin },
      locks: {
        tableSession: vi
          .fn()
          .mockResolvedValueOnce(session(true, 3, 1))
          .mockResolvedValueOnce(session(false, 3, 9)),
      },
      repository: { create: vi.fn().mockResolvedValue(order({ tableSessionId: 9 })) },
      events: { orderCreated: vi.fn() },
    });

    await expect(orders.create({ tableId: 3 })).resolves.toMatchObject({ tableSessionId: 9 });
    expect(openOrJoin).toHaveBeenCalledTimes(2);
  });

  it('07 gives up after the table is cleared twice', async () => {
    const orders = await service({
      sessions: { openOrJoin: vi.fn().mockResolvedValue({ session: { id: 1 } }) },
      locks: { tableSession: vi.fn().mockResolvedValue(session(true)) },
    });

    await expect(orders.create({ tableId: 3 })).rejects.toThrow('cleared twice');
  });

  it.each(['P2003', 'P2025'])('08 maps an unknown reference (%s) to 400', async (code) => {
    const orders = await service({
      sessions: { openOrJoin: vi.fn().mockResolvedValue({ session: { id: 2 } }) },
      locks: { tableSession: vi.fn().mockResolvedValue(session()) },
      repository: { create: vi.fn().mockRejectedValue(prismaError(code)) },
    });

    await expect(orders.create({ tableId: 3, items: [{ productId: 99 }] })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('U-SV-ORD-09..12 payment and reassignment', () => {
  it('09 refuses payment while items are unserved, without an event', async () => {
    const orderClosed = vi.fn();
    const orders = await service({
      orderLock: { forChange: vi.fn().mockResolvedValue({ status: 'OPEN' }) },
      repository: { countUnservedItems: vi.fn().mockResolvedValue(1) },
      events: { orderClosed },
    });

    await expect(orders.close(1)).rejects.toThrow('still has 1 item that has not been served');
    expect(orderClosed).not.toHaveBeenCalled();
  });

  it('10 treats paying a paid order as a no-op', async () => {
    const forChange = vi.fn().mockResolvedValue({ status: 'CLOSED' });
    const orderClosed = vi.fn();
    const orders = await service({
      orderLock: { forChange },
      repository: { findById: vi.fn().mockResolvedValue(order({ status: 'CLOSED' })) },
      events: { orderClosed },
    });

    await expect(orders.close(1)).resolves.toMatchObject({ status: 'CLOSED' });
    expect(forChange).toHaveBeenCalledWith(1, { allowClosed: true });
    expect(orderClosed).not.toHaveBeenCalled();
  });

  it('11 closes a fully served order and records it', async () => {
    const closed = order({ status: 'CLOSED' });
    const orderClosed = vi.fn();
    const orders = await service({
      orderLock: { forChange: vi.fn().mockResolvedValue({ status: 'OPEN' }) },
      repository: {
        countUnservedItems: vi.fn().mockResolvedValue(0),
        close: vi.fn().mockResolvedValue(closed),
      },
      events: { orderClosed },
    });

    await expect(orders.close(1)).resolves.toBe(closed);
    expect(orderClosed).toHaveBeenCalledWith(closed);
  });

  it('12 maps an unknown employee on reassignment to 400', async () => {
    const orders = await service({
      orderLock: { forChange: vi.fn().mockResolvedValue({}) },
      repository: { update: vi.fn().mockRejectedValue(prismaError('P2003')) },
    });

    await expect(orders.update(1, { employeeId: 999 })).rejects.toThrow(BadRequestException);
  });
});
