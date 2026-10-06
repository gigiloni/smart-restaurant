import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { prismaError, withTransactions } from '../../test/support/unit.js';
import { RowLocks } from '../database/row-locks.js';
import { OrderEventsWriter } from '../order-events/order-events.writer.js';
import { TableSessionsRepository } from './table-sessions.repository.js';
import { TableSessionsService } from './table-sessions.service.js';

const service = (c: { locks?: object; events?: object; repository?: object } = {}) =>
  withTransactions(TableSessionsService, [
    { provide: RowLocks, useValue: c.locks ?? {} },
    { provide: OrderEventsWriter, useValue: c.events ?? {} },
    { provide: TableSessionsRepository, useValue: c.repository ?? {} },
  ]);

const locked = (tableId: number, closed = false) => ({
  tableSession: vi.fn().mockResolvedValue({ id: 1, tableId, closedAt: closed ? new Date() : null }),
});

describe('U-SV-SES TableSessionsService', () => {
  it('01 joins the party already seated, without an event', async () => {
    const sessionOpened = vi.fn();
    const sessions = await service({
      repository: { findOpenByTable: vi.fn().mockResolvedValue({ id: 5 }) },
      events: { sessionOpened },
    });

    await expect(sessions.openOrJoin(1)).resolves.toEqual({ session: { id: 5 }, created: false });
    expect(sessionOpened).not.toHaveBeenCalled();
  });

  it('02 seats a new party at a free table and records it', async () => {
    const sessionOpened = vi.fn();
    const sessions = await service({
      repository: {
        findOpenByTable: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 6 }),
      },
      events: { sessionOpened },
    });

    await expect(sessions.openOrJoin(1)).resolves.toEqual({ session: { id: 6 }, created: true });
    expect(sessionOpened).toHaveBeenCalledOnce();
    expect(sessionOpened).toHaveBeenCalledWith({ id: 6 });
  });

  it('03 joins the winner when two scans race', async () => {
    const sessions = await service({
      repository: {
        findOpenByTable: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 7 }),
        create: vi.fn().mockRejectedValue(prismaError('P2002')),
      },
    });

    await expect(sessions.openOrJoin(1)).resolves.toEqual({ session: { id: 7 }, created: false });
  });

  it('04 maps an unknown table to 400', async () => {
    const sessions = await service({
      repository: {
        findOpenByTable: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(prismaError('P2003')),
      },
    });

    await expect(sessions.openOrJoin(99)).rejects.toThrow('Table 99 does not exist');
  });

  it('05 refuses a move to an occupied table', async () => {
    const sessions = await service({
      locks: locked(1),
      repository: { move: vi.fn().mockRejectedValue(prismaError('P2002')) },
    });

    const moving = sessions.move(1, 2);

    await expect(moving).rejects.toBeInstanceOf(ConflictException);
    await expect(moving).rejects.toThrow('already has a seated party');
  });

  it('06 refuses to move a cleared party and answers 404 for an unknown one', async () => {
    await expect((await service({ locks: locked(1, true) })).move(1, 2)).rejects.toThrow(
      ConflictException,
    );
    await expect(
      (await service({ locks: { tableSession: vi.fn().mockResolvedValue(null) } })).move(1, 2),
    ).rejects.toThrow(NotFoundException);
  });

  it('07 treats a move to the same table as a no-op', async () => {
    const move = vi.fn();
    const sessionMoved = vi.fn();
    const sessions = await service({
      locks: locked(2),
      repository: { move, findById: vi.fn().mockResolvedValue({ id: 1 }) },
      events: { sessionMoved },
    });

    await sessions.move(1, 2);

    expect(move).not.toHaveBeenCalled();
    expect(sessionMoved).not.toHaveBeenCalled();
  });

  it('08 keeps the table while orders are unpaid', async () => {
    const sessions = await service({
      locks: locked(1),
      repository: { countOpenOrders: vi.fn().mockResolvedValue(2) },
    });

    const clearing = sessions.close(1);

    await expect(clearing).rejects.toBeInstanceOf(ConflictException);
    await expect(clearing).rejects.toThrow('still has 2 unpaid orders: close them');
  });

  it('09 treats clearing a cleared table as a no-op', async () => {
    const sessionClosed = vi.fn();
    const sessions = await service({
      locks: locked(1, true),
      repository: { findById: vi.fn().mockResolvedValue({ id: 1 }) },
      events: { sessionClosed },
    });

    await sessions.close(1);

    expect(sessionClosed).not.toHaveBeenCalled();
  });

  it('10 moves the party and records the table it left', async () => {
    const moved = { id: 1, tableId: 2 };
    const move = vi.fn().mockResolvedValue(moved);
    const sessionMoved = vi.fn();
    const sessions = await service({
      locks: locked(1),
      repository: { move, findById: vi.fn().mockResolvedValue({ id: 1, tableId: 2 }) },
      events: { sessionMoved },
    });

    await expect(sessions.move(1, 2)).resolves.toEqual({ id: 1, tableId: 2 });
    expect(move).toHaveBeenCalledWith(1, 2);
    expect(sessionMoved).toHaveBeenCalledWith(moved, 1);
  });

  it('11 maps a move to an unknown table to 400', async () => {
    const sessions = await service({
      locks: locked(1),
      repository: { move: vi.fn().mockRejectedValue(prismaError('P2003')) },
    });

    await expect(sessions.move(1, 99)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('12 clears a table whose orders are all paid, and records it', async () => {
    const closed = { id: 1, closedAt: new Date() };
    const close = vi.fn().mockResolvedValue(closed);
    const sessionClosed = vi.fn();
    const sessions = await service({
      locks: locked(1),
      repository: {
        countOpenOrders: vi.fn().mockResolvedValue(0),
        close,
        findById: vi.fn().mockResolvedValue(closed),
      },
      events: { sessionClosed },
    });

    await expect(sessions.close(1)).resolves.toBe(closed);
    expect(sessionClosed).toHaveBeenCalledWith(closed);
  });

  it('13 answers 404 when clearing an unknown session', async () => {
    const sessions = await service({ locks: { tableSession: vi.fn().mockResolvedValue(null) } });

    await expect(sessions.close(1)).rejects.toThrow(NotFoundException);
  });

  it('14 rethrows an insert conflict when no winning session can be found', async () => {
    const conflict = prismaError('P2002');
    const sessions = await service({
      repository: {
        findOpenByTable: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(conflict),
      },
    });

    await expect(sessions.openOrJoin(1)).rejects.toBe(conflict);
  });
});
