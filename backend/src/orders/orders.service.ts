import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { CreateOrderDto, PaginationQuery, UpdateOrderDto } from '@smart-restaurant/contracts';

import { PrismaErrorCode, isPrismaError } from '../database/prisma-error.js';
import { Propagation, Transactional } from '@nestjs-cls/transactional';

import { RowLocks } from '../database/row-locks.js';
import { OrderEventsWriter } from '../order-events/order-events.writer.js';
import { TableSessionsService } from '../table-sessions/table-sessions.service.js';
import { requireOpenOrder } from './order-guards.js';
import { OrdersRepository, type OrderWithDetails } from './orders.repository.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly locks: RowLocks,
    private readonly events: OrderEventsWriter,
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
   *
   * Seating and placing are two transactions, so this must not run inside
   * another one (`Propagation.Never` enforces that).
   */
  @Transactional(Propagation.Never)
  async create({ tableId, ...dto }: CreateOrderDto): Promise<OrderWithDetails> {
    for (let attempt = 1; ; attempt++) {
      const { session } = await this.tableSessionsService.openOrJoin(tableId);

      try {
        const order = await this.placeInSession(session.id, dto);

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

  /** The order, or null if the session was cleared before its lock was taken. */
  @Transactional()
  private async placeInSession(
    tableSessionId: number,
    dto: Omit<CreateOrderDto, 'tableId'>,
  ): Promise<OrderWithDetails | null> {
    const locked = await this.locks.tableSession(tableSessionId);

    if (!locked || locked.closedAt) {
      return null;
    }

    const created = await this.ordersRepository.create({
      ...dto,
      tableSessionId: locked.id,
      tableId: locked.tableId,
    });

    await this.events.orderCreated(created);

    return created;
  }

  async update(id: number, dto: UpdateOrderDto): Promise<OrderWithDetails> {
    try {
      return await this.updateOpenOrder(id, dto);
    } catch (error) {
      throw this.mapUnknownReference(error);
    }
  }

  @Transactional()
  private async updateOpenOrder(id: number, dto: UpdateOrderDto): Promise<OrderWithDetails> {
    requireOpenOrder(await this.locks.order(id), id);

    const updated = await this.ordersRepository.update(id, dto);

    await this.events.orderUpdated(updated);

    return updated;
  }

  /**
   * Closing an order is taking payment for it, so everything on it has to have
   * reached the table first. Closing an already closed order is accepted, so a
   * retried request is safe.
   */
  @Transactional()
  async close(id: number): Promise<OrderWithDetails> {
    const order = await this.locks.order(id);

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    if (order.status === 'CLOSED') {
      return this.ordersRepository.findById(id) as Promise<OrderWithDetails>;
    }

    const unserved = await this.ordersRepository.countUnservedItems(id);

    if (unserved > 0) {
      throw new ConflictException(
        `Order ${id} still has ${unserved} item${unserved === 1 ? '' : 's'} that ${unserved === 1 ? 'has' : 'have'} not been served: an order can only be paid once everything on it has reached the table`,
      );
    }

    const closed = await this.ordersRepository.close(id);

    await this.events.orderClosed(closed);

    return closed;
  }

  @Transactional()
  async remove(id: number): Promise<OrderWithDetails> {
    requireOpenOrder(await this.locks.order(id), id);

    // The delete returns the order with its items as they were, and the
    // cascade removes those items in the same statement, so this one event
    // accounts for every item that disappears with it.
    const removed = await this.ordersRepository.remove(id);

    await this.events.orderDeleted(removed);

    return removed;
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
