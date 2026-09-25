import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaErrorCode, isPrismaError } from '../database/prisma-error.js';
import { PrismaService } from '../database/prisma.service.js';
import { lockTableSession } from '../database/row-locks.js';
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
    private readonly prisma: PrismaService,
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
   */
  async openOrJoin(tableId: number): Promise<OpenedTableSession> {
    const existing = await this.tableSessionsRepository.findOpenByTable(tableId);

    if (existing) {
      return { session: existing, created: false };
    }

    try {
      return {
        session: await this.tableSessionsRepository.create(tableId),
        created: true,
      };
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
      await this.prisma.$transaction(async (tx) => {
        const session = await lockTableSession(tx, id);

        if (!session) {
          throw new NotFoundException(`Table session ${id} not found`);
        }

        if (session.closedAt) {
          throw new ConflictException(`Table session ${id} is closed: its table has been cleared`);
        }

        if (session.tableId !== tableId) {
          await this.tableSessionsRepository.move(id, tableId, tx);
        }
      });
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
    await this.prisma.$transaction(async (tx) => {
      const session = await lockTableSession(tx, id);

      if (!session) {
        throw new NotFoundException(`Table session ${id} not found`);
      }

      if (session.closedAt) {
        return;
      }

      const openOrders = await this.tableSessionsRepository.countOpenOrders(id, tx);

      if (openOrders > 0) {
        throw new ConflictException(
          `Table session ${id} still has ${openOrders} unpaid order${openOrders === 1 ? '' : 's'}: close ${openOrders === 1 ? 'it' : 'them'} before clearing the table`,
        );
      }

      await this.tableSessionsRepository.close(id, tx);
    });

    return this.findOne(id);
  }
}
