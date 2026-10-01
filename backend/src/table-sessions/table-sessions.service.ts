import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaErrorCode, isPrismaError } from '../database/prisma-error.js';
import { Propagation, Transactional } from '@nestjs-cls/transactional';

import { RowLocks } from '../database/row-locks.js';
import { OrderEventsWriter } from '../order-events/order-events.writer.js';
import {
  TableSessionsRepository,
  type TableSessionWithDetails,
  type TableSessionWithTable,
} from './table-sessions.repository.js';

export interface OpenedTableSession {
  session: TableSessionWithTable;

  /** False when the table already had an open session and it was joined. */
  created: boolean;
}

@Injectable()
export class TableSessionsService {
  constructor(
    private readonly locks: RowLocks,
    private readonly events: OrderEventsWriter,
    private readonly tableSessionsRepository: TableSessionsRepository,
  ) {}

  findOpen(): Promise<TableSessionWithTable[]> {
    return this.tableSessionsRepository.findOpen();
  }

  async findOne(id: number): Promise<TableSessionWithDetails> {
    const session = await this.tableSessionsRepository.findById(id);

    if (!session) {
      throw new NotFoundException(`Table session ${id} not found`);
    }

    return session;
  }

  /**
   * Joins the table's open session, or opens one if the table is free. Every
   * guest scanning the same QR code must land in the same session, so this is
   * idempotent rather than always creating.
   *
   * Must not run inside a transaction: when two scans race, the loser's insert
   * fails, and it then has to read the winner's session. Inside a transaction
   * that failure would have aborted everything (`Propagation.Never`).
   */
  @Transactional(Propagation.Never)
  async openOrJoin(tableId: number): Promise<OpenedTableSession> {
    const existing = await this.tableSessionsRepository.findOpenByTable(tableId);

    if (existing) {
      return { session: existing, created: false };
    }

    try {
      return { session: await this.openSession(tableId), created: true };
    } catch (error) {
      // Two guests scanned at the same moment and both saw a free table. The
      // partial unique index let exactly one of them open it; join that one.
      if (isPrismaError(error, PrismaErrorCode.UniqueConstraintViolation)) {
        const winner = await this.tableSessionsRepository.findOpenByTable(tableId);

        if (winner) {
          return { session: winner, created: false };
        }
      }

      if (isPrismaError(error, PrismaErrorCode.ForeignKeyConstraintViolation)) {
        throw new BadRequestException(`Table ${tableId} does not exist`);
      }

      throw error;
    }
  }

  async move(id: number, tableId: number): Promise<TableSessionWithDetails> {
    try {
      await this.moveOpenSession(id, tableId);
    } catch (error) {
      if (isPrismaError(error, PrismaErrorCode.UniqueConstraintViolation)) {
        throw new ConflictException(`Table ${tableId} already has a seated party`);
      }

      if (isPrismaError(error, PrismaErrorCode.ForeignKeyConstraintViolation)) {
        throw new BadRequestException(`Table ${tableId} does not exist`);
      }

      throw error;
    }

    return this.findOne(id);
  }

  /**
   * Clears the table for the next party. Every order has to be paid first, so
   * nothing is left owing when the session — and with it guest access — ends.
   * Clearing an already cleared table is accepted, so a retried request is safe.
   */
  async close(id: number): Promise<TableSessionWithDetails> {
    await this.closeOpenSession(id);

    return this.findOne(id);
  }

  @Transactional()
  private async openSession(tableId: number): Promise<TableSessionWithTable> {
    const opened = await this.tableSessionsRepository.create(tableId);

    await this.events.sessionOpened(opened);

    return opened;
  }

  @Transactional()
  private async moveOpenSession(id: number, tableId: number): Promise<void> {
    const session = await this.locks.tableSession(id);

    if (!session) {
      throw new NotFoundException(`Table session ${id} not found`);
    }

    if (session.closedAt) {
      throw new ConflictException(`Table session ${id} is closed: its table has been cleared`);
    }

    if (session.tableId !== tableId) {
      const moved = await this.tableSessionsRepository.move(id, tableId);

      await this.events.sessionMoved(moved, session.tableId);
    }
  }

  @Transactional()
  private async closeOpenSession(id: number): Promise<void> {
    const session = await this.locks.tableSession(id);

    if (!session) {
      throw new NotFoundException(`Table session ${id} not found`);
    }

    if (session.closedAt) {
      return;
    }

    const openOrders = await this.tableSessionsRepository.countOpenOrders(id);

    if (openOrders > 0) {
      throw new ConflictException(
        `Table session ${id} still has ${openOrders} unpaid order${openOrders === 1 ? '' : 's'}: close ${openOrders === 1 ? 'it' : 'them'} before clearing the table`,
      );
    }

    const closed = await this.tableSessionsRepository.close(id);

    await this.events.sessionClosed(closed);
  }
}
