import { Injectable } from '@nestjs/common';
import { Propagation, TransactionHost, Transactional } from '@nestjs-cls/transactional';

import type {
  Ingredient,
  OrderEventType,
  OrderItemStatus,
  ProductType,
} from '@smart-restaurant/contracts';

import type { PrismaAdapter } from '../database/transaction.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedEmployee } from '../auth/auth.types.js';

/** The channel the live feed listens on. Notifications are only sent on commit. */
export const ORDER_EVENTS_CHANNEL = 'order_events';

interface DraftOrderEvent {
  guestId?: string | null;
  statusChange?: { actor: AuthenticatedEmployee; previousStatus: string; status: string };
  type: OrderEventType;
  tableSessionId: number;
  orderId?: number;
  orderItemId?: number;
  productType?: ProductType;
  productTypes?: ProductType[];
  data: unknown;
}

interface SessionLike {
  id: number;
}

interface OrderLike {
  guestId?: string | null;
  id: number;
  tableSessionId: number;
  orderItems: { product: { type: ProductType } }[];
}

interface ItemLike {
  status?: OrderItemStatus;
  id: number;
  orderId: number;
  product: { type: ProductType };
}

/**
 * Appends order events inside the caller's transaction: the one its
 * `@Transactional()` method opened.
 *
 * Call it as the LAST write of a transaction. Bumping the counter takes a lock
 * on its single row that every event-writing transaction needs and that is only
 * released at commit, so whatever runs after the append runs while every other
 * writer in the restaurant waits.
 */
@Injectable()
export class OrderEventsWriter {
  constructor(private readonly txHost: TransactionHost<PrismaAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  inventoryUpdated(ingredientId: number, ingredient: Ingredient | null) {
    return this.append({
      type: 'inventory.updated',
      tableSessionId: 0,
      data: { ingredientId, ingredient },
    });
  }

  sessionOpened(session: SessionLike) {
    return this.append({
      type: 'session.opened',
      tableSessionId: session.id,
      data: { session },
    });
  }

  async sessionMoved(session: SessionLike, previousTableId: number) {
    return this.append({
      type: 'session.moved',
      tableSessionId: session.id,
      productTypes: await this.openProductTypesOfSession(session.id),
      data: { session, previousTableId },
    });
  }

  sessionClosed(session: SessionLike) {
    return this.append({
      type: 'session.closed',
      tableSessionId: session.id,
      data: { session },
    });
  }

  orderCreated(order: OrderLike) {
    return this.appendOrder('order.created', order);
  }

  orderUpdated(order: OrderLike) {
    return this.appendOrder('order.updated', order);
  }

  orderClosed(order: OrderLike, actor?: AuthenticatedEmployee) {
    if (!actor) throw new Error('A status change requires an authenticated employee');
    return this.appendOrder('order.closed', order, {
      actor,
      previousStatus: 'OPEN',
      status: 'CLOSED',
    });
  }

  /** `order` is the order as it was immediately before deletion, items included. */
  orderDeleted(order: OrderLike) {
    return this.appendOrder('order.deleted', order);
  }

  itemCreated(item: ItemLike) {
    return this.appendItem('item.created', item);
  }

  itemStatusChanged(item: ItemLike, previousStatus: OrderItemStatus, actor: AuthenticatedEmployee) {
    if (!item.status) throw new Error('A status change requires the new status');
    return this.appendItem(
      'item.status_changed',
      item,
      { previousStatus },
      {
        actor,
        previousStatus,
        status: item.status,
      },
    );
  }

  /** `item` is the item as it was immediately before deletion. */
  itemDeleted(item: ItemLike) {
    return this.appendItem('item.deleted', item);
  }

  private appendOrder(
    type: OrderEventType,
    order: OrderLike,
    statusChange?: DraftOrderEvent['statusChange'],
  ) {
    return this.append({
      type,
      tableSessionId: order.tableSessionId,
      orderId: order.id,
      guestId: order.guestId,
      statusChange,
      productTypes: distinct(order.orderItems.map((item) => item.product.type)),
      data: { order },
    });
  }

  private async appendItem(
    type: OrderEventType,
    item: ItemLike,
    extra: Record<string, unknown> = {},
    statusChange?: DraftOrderEvent['statusChange'],
  ) {
    const order = await this.db.order.findUniqueOrThrow({
      where: { id: item.orderId },
      select: {
        id: true,
        tableSessionId: true,
        guestId: true,
        tableId: true,
        status: true,
        table: { select: { tableNumber: true } },
      },
    });

    return this.append({
      type,
      tableSessionId: order.tableSessionId,
      orderId: order.id,
      guestId: order.guestId,
      statusChange,
      orderItemId: item.id,
      productType: item.product.type,
      data: {
        item,
        order: {
          id: order.id,
          tableSessionId: order.tableSessionId,
          tableId: order.tableId,
          tableNumber: order.table.tableNumber,
          status: order.status,
        },
        ...extra,
      },
    });
  }

  /**
   * `Propagation.Mandatory`: an event has to commit with the change it
   * describes or not at all, and the counter's lock must be held until that
   * commit, so writing outside a transaction throws.
   */
  @Transactional(Propagation.Mandatory)
  private async append(event: DraftOrderEvent): Promise<bigint> {
    // Row-locked counter rather than a sequence: see OrderEvent in schema.prisma.
    const [{ value: id }] = await this.db.$queryRaw<{ value: bigint }[]>`
      UPDATE "Order_Event_Counter" SET value = value + 1 WHERE id = 1 RETURNING value`;

    await this.db.orderEvent.create({
      data: {
        id,
        type: event.type,
        tableSessionId: event.tableSessionId,
        orderId: event.orderId,
        orderItemId: event.orderItemId,
        guestId: event.guestId,
        productType: event.productType,
        productTypes: event.productTypes ?? [],
        // Round-trip through JSON so the stored payload is exactly what the
        // REST API returns for the same entity: dates as ISO strings, prices as
        // decimal strings.
        payload: JSON.parse(JSON.stringify(event.data)) as Prisma.InputJsonValue,
      },
    });

    if (event.statusChange) {
      if (event.orderId === undefined) throw new Error('A status audit requires an order');
      const { actor, previousStatus, status } = event.statusChange;
      await this.db.orderStatusLog.create({
        data: {
          eventId: id,
          employeeId: actor.id,
          employeeRole: actor.role,
          orderId: event.orderId,
          orderItemId: event.orderItemId,
          previousStatus,
          status,
        },
      });
    }

    // Delivered only if the transaction commits, and in commit order. The
    // payload is constant so several events in one transaction collapse into a
    // single notification: listeners re-read the log rather than trust it.
    await this.db.$executeRaw`SELECT pg_notify(${ORDER_EVENTS_CHANNEL}, '')`;

    return id;
  }

  private async openProductTypesOfSession(tableSessionId: number): Promise<ProductType[]> {
    const items = await this.db.orderItem.findMany({
      where: { order: { tableSessionId, status: 'OPEN' } },
      select: { product: { select: { type: true } } },
    });

    return distinct(items.map((item) => item.product.type));
  }
}

function distinct<T>(values: T[]): T[] {
  return [...new Set(values)];
}
