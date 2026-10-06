import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { CreateOrderDto, PaginationQuery, UpdateOrderDto } from '@smart-restaurant/contracts';

import { PrismaErrorCode, isPrismaError } from '../database/prisma-error.js';
import { Propagation, Transactional } from '@nestjs-cls/transactional';

import type { GuestViewer } from '../auth/viewer.types.js';
import type { Viewer } from '../auth/viewer.types.js';
import { stationProductTypes, onlyStationItems, orderForGuest } from '../live/live-scope.js';
import { RowLocks } from '../database/row-locks.js';
import { OrderEventsWriter } from '../order-events/order-events.writer.js';
import { TableSessionsService } from '../table-sessions/table-sessions.service.js';
import { OrderLock, type OrderChange } from './order-lock.js';
import { OrdersRepository, type OrderWithDetails } from './orders.repository.js';
import { StockService } from '../ingredients/stock.service.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly stock: StockService,
    private readonly locks: RowLocks,
    private readonly orderLock: OrderLock,
    private readonly events: OrderEventsWriter,
    private readonly ordersRepository: OrdersRepository,
    private readonly tableSessionsService: TableSessionsService,
  ) {}

  findAll(pagination: PaginationQuery): Promise<OrderWithDetails[]> {
    return this.ordersRepository.findAll(pagination);
  }

  async findVisible(pagination: PaginationQuery, viewer: Viewer) {
    const station = stationProductTypes(viewer);
    const where =
      viewer.kind === 'guest'
        ? { tableSessionId: viewer.tableSessionId, guestId: viewer.guestId }
        : station
          ? {
              status: 'OPEN' as const,
              tableSession: { closedAt: null },
              orderItems: { some: { product: { type: { in: [...station] } } } },
            }
          : undefined;
    const orders = await this.ordersRepository.findAll(pagination, where);
    return orders.map((order) =>
      viewer.kind === 'guest'
        ? orderForGuest(order)
        : station
          ? onlyStationItems(order, station)
          : order,
    );
  }

  async findOneVisible(id: number, viewer: Viewer) {
    const order = await this.findOne(id);
    if (viewer.kind === 'guest') {
      if (order.tableSessionId !== viewer.tableSessionId || order.guestId !== viewer.guestId)
        throw new NotFoundException(`Order ${id} not found`);
      return orderForGuest(order);
    }
    const station = stationProductTypes(viewer);
    if (!station) return order;
    const visible = onlyStationItems(order, station);
    if (order.status !== 'OPEN' || !visible.orderItems.length)
      throw new NotFoundException(`Order ${id} not found`);
    return visible;
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

  /**
   * Places a guest's order with their own party. Unlike `create`, it never
   * seats anyone: a guest whose party has left or moved gets 409 rather than an
   * order at a table they are not sitting at.
   */
  async createForGuest(guest: GuestViewer, dto: CreateOrderDto): Promise<OrderWithDetails> {
    if (dto.employeeId !== undefined && dto.employeeId !== null) {
      throw new ForbiddenException('Guests cannot assign an order to an employee');
    }

    if (!dto.items?.length) {
      throw new BadRequestException('items: a guest order needs at least one item');
    }

    let order: OrderWithDetails | null;

    try {
      order = await this.placeInSession(
        guest.tableSessionId,
        { employeeId: null, items: dto.items },
        dto.tableId,
        guest.guestId,
      );
    } catch (error) {
      throw this.mapUnknownReference(error);
    }

    if (!order) {
      throw new ConflictException('Your table has been cleared; scan the QR code again');
    }

    return orderForGuest(order);
  }

  /**
   * Places an order in a session under the session's lock, so the session
   * cannot be cleared or moved underneath it. Null if it has been cleared.
   *
   * With `expectedTableId` — a guest ordering from the table they believe they
   * are at — a party that has moved since gets 409 instead of an order.
   */
  @Transactional()
  private async placeInSession(
    tableSessionId: number,
    dto: Omit<CreateOrderDto, 'tableId'>,
    expectedTableId?: number,
    guestId?: string,
  ): Promise<OrderWithDetails | null> {
    const session = await this.locks.tableSession(tableSessionId);

    if (!session || session.closedAt) {
      return null;
    }

    if (expectedTableId !== undefined && expectedTableId !== session.tableId) {
      const tableNumber = await this.ordersRepository.tableNumberOf(session.tableId);

      throw new ConflictException(
        `Your party is seated at table ${tableNumber} (id ${session.tableId}), not table id ${expectedTableId}`,
      );
    }

    const created = await this.ordersRepository.create({
      ...dto,
      guestId,
      tableSessionId: session.id,
      tableId: session.tableId,
    });

    const ingredients = await this.stock.book(created.orderItems);
    await this.events.orderCreated(created);
    await this.stock.publish(ingredients);

    return created;
  }

  async update(id: number, dto: UpdateOrderDto, by: OrderChange = {}): Promise<OrderWithDetails> {
    try {
      return await this.updateOpenOrder(id, dto, by);
    } catch (error) {
      throw this.mapUnknownReference(error);
    }
  }

  @Transactional()
  private async updateOpenOrder(
    id: number,
    dto: UpdateOrderDto,
    by: OrderChange,
  ): Promise<OrderWithDetails> {
    await this.orderLock.forChange(id, by);

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
  async close(id: number, by: OrderChange = {}): Promise<OrderWithDetails> {
    const order = await this.orderLock.forChange(id, { ...by, allowClosed: true });

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

    await this.events.orderClosed(closed, by.actor);

    return closed;
  }

  @Transactional()
  async remove(id: number, by: OrderChange = {}): Promise<OrderWithDetails> {
    await this.orderLock.forChange(id, by);
    const current = await this.findOne(id);
    const ingredients = await this.stock.refund(current.orderItems);

    // The delete returns the order with its items as they were, and the
    // cascade removes those items in the same statement, so this one event
    // accounts for every item that disappears with it.
    const removed = await this.ordersRepository.remove(id);

    await this.events.orderDeleted(removed);
    await this.stock.publish(ingredients);

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
