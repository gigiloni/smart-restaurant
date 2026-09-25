import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { CreateOrderDto, PaginationQuery, UpdateOrderDto } from '@smart-restaurant/contracts';

import { PrismaErrorCode, isPrismaError } from '../database/prisma-error.js';
import { PrismaService } from '../database/prisma.service.js';
import { lockOrder, lockTableSession } from '../database/row-locks.js';
import { TableSessionsService } from '../table-sessions/table-sessions.service.js';
import { requireOpenOrder } from './order-guards.js';
import { OrdersRepository, type OrderWithDetails } from './orders.repository.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersRepository: OrdersRepository,
    private readonly tableSessionsService: TableSessionsService,
  ) {}

  findAll(pagination: PaginationQuery): Promise<OrderWithDetails[]> {
    return this.ordersRepository.findAll(pagination);
  }

  async findOne(id: number): Promise<OrderWithDetails> {
    const order = await this.ordersRepository.findById(id);

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
  }

  /**
   * Places an order in the table's open session, opening one if the table is
   * free. The session is locked while the order is written, so it cannot be
   * cleared or moved underneath the new order.
   *
   * If service clears the table in the moment between finding the session and
   * locking it, the party has left by definition, so the order belongs to the
   * next one: seat a new party and place it there. One retry is enough; a table
   * cleared twice within a single request is reported instead.
   */
  async create({ tableId, ...dto }: CreateOrderDto): Promise<OrderWithDetails> {
    for (let attempt = 1; ; attempt++) {
      const { session } = await this.tableSessionsService.openOrJoin(tableId);

      try {
        const order = await this.prisma.$transaction(async (tx) => {
          const locked = await lockTableSession(tx, session.id);

          if (!locked || locked.closedAt) {
            return null;
          }

          return this.ordersRepository.create(
            { ...dto, tableSessionId: locked.id, tableId: locked.tableId },
            tx,
          );
        });

        if (order) {
          return order;
        }
      } catch (error) {
        throw this.mapUnknownReference(error);
      }

      if (attempt === 2) {
        throw new ConflictException(
          `Table ${tableId} was cleared twice while the order was being placed. Retry.`,
        );
      }
    }
  }

  async update(id: number, dto: UpdateOrderDto): Promise<OrderWithDetails> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        requireOpenOrder(await lockOrder(tx, id), id);

        return this.ordersRepository.update(id, dto, tx);
      });
    } catch (error) {
      throw this.mapUnknownReference(error);
    }
  }

  /**
   * Closing an order is taking payment for it, so everything on it has to have
   * reached the table first. Closing an already closed order is accepted, so a
   * retried request is safe.
   */
  close(id: number): Promise<OrderWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, id);

      if (!order) {
        throw new NotFoundException(`Order ${id} not found`);
      }

      if (order.status === 'CLOSED') {
        return this.ordersRepository.findById(id, tx) as Promise<OrderWithDetails>;
      }

      const unserved = await this.ordersRepository.countUnservedItems(id, tx);

      if (unserved > 0) {
        throw new ConflictException(
          `Order ${id} still has ${unserved} item${unserved === 1 ? '' : 's'} that ${unserved === 1 ? 'has' : 'have'} not been served: an order can only be paid once everything on it has reached the table`,
        );
      }

      return this.ordersRepository.close(id, tx);
    });
  }

  remove(id: number): Promise<OrderWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      requireOpenOrder(await lockOrder(tx, id), id);

      return this.ordersRepository.remove(id, tx);
    });
  }

  /**
   * An order points at a table, an employee and — through its items — at
   * products. A missing one of those is a bad payload, not a missing order.
   */
  private mapUnknownReference(error: unknown): unknown {
    if (
      isPrismaError(error, PrismaErrorCode.ForeignKeyConstraintViolation) ||
      isPrismaError(error, PrismaErrorCode.RecordNotFound)
    ) {
      return new BadRequestException(
        'One or more of the referenced table, employee or products do not exist',
      );
    }

    return error;
  }
}
