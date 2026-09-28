import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import type { OrderEventType, OrderItemStatus, ProductType } from '@smart-restaurant/contracts';

import type { PrismaAdapter } from '../database/transaction.js';
import type { Prisma } from '../generated/prisma/client.js';

/** The channel the live feed listens on. Notifications are only sent on commit. */
export const ORDER_EVENTS_CHANNEL = 'order_events';

interface DraftOrderEvent {
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
  id: number;
  tableSessionId: number;
  orderItems: { product: { type: ProductType } }[];
}

interface ItemLike {
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

  /**
   * An event has to commit with the change it describes or not at all, and the
   * counter's lock must be held until that commit: refuse to write outside a
   * transaction rather than record a change that might never happen.
   */
  private db() {
    if (!this.txHost.isTransactionActive()) {
      throw new Error(
        'Order events are only written inside a transaction: call from a @Transactional() method',
      );
    }

    return this.txHost.tx;
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

  orderClosed(order: OrderLike) {
    return this.appendOrder('order.closed', order);
  }

  /** `order` is the order as it was immediately before deletion, items included. */
  orderDeleted(order: OrderLike) {
    return this.appendOrder('order.deleted', order);
  }

  itemCreated(item: ItemLike) {
    return this.appendItem('item.created', item);
  }

  itemStatusChanged(item: ItemLike, previousStatus: OrderItemStatus) {
    return this.appendItem('item.status_changed', item, { previousStatus });
  }

  /** `item` is the item as it was immediately before deletion. */
  itemDeleted(item: ItemLike) {
    return this.appendItem('item.deleted', item);
  }

  private appendOrder(type: OrderEventType, order: OrderLike) {
    return this.append({
      type,
      tableSessionId: order.tableSessionId,
      orderId: order.id,
      productTypes: distinct(order.orderItems.map((item) => item.product.type)),
      data: { order },
    });
  }

  private async appendItem(
    type: OrderEventType,
    item: ItemLike,
    extra: Record<string, unknown> = {},
  ) {
    const order = await this.db().order.findUniqueOrThrow({
      where: { id: item.orderId },
      select: {
        id: true,
        tableSessionId: true,
        tableId: true,
        status: true,
        table: { select: { tableNumber: true } },
      },
    });

    return this.append({
      type,
      tableSessionId: order.tableSessionId,
      orderId: order.id,
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

  private async append(event: DraftOrderEvent): Promise<bigint> {
    // Row-locked counter rather than a sequence: see OrderEvent in schema.prisma.
    const [{ value: id }] = await this.db().$queryRaw<{ value: bigint }[]>`
      UPDATE "Order_Event_Counter" SET value = value + 1 WHERE id = 1 RETURNING value`;

    await this.db().orderEvent.create({
      data: {
        id,
        type: event.type,
        tableSessionId: event.tableSessionId,
        orderId: event.orderId,
        orderItemId: event.orderItemId,
        productType: event.productType,
        productTypes: event.productTypes ?? [],
        // Round-trip through JSON so the stored payload is exactly what the
        // REST API returns for the same entity: dates as ISO strings, prices as
        // decimal strings.
        payload: JSON.parse(JSON.stringify(event.data)) as Prisma.InputJsonValue,
      },
    });

    // Delivered only if the transaction commits, and in commit order. The
    // payload is constant so several events in one transaction collapse into a
    // single notification: listeners re-read the log rather than trust it.
    await this.db().$executeRaw`SELECT pg_notify(${ORDER_EVENTS_CHANNEL}, '')`;

    return id;
  }

  private async openProductTypesOfSession(tableSessionId: number): Promise<ProductType[]> {
    const items = await this.db().orderItem.findMany({
      where: { order: { tableSessionId, status: 'OPEN' } },
      select: { product: { select: { type: true } } },
    });

    return distinct(items.map((item) => item.product.type));
  }
}

function distinct<T>(values: T[]): T[] {
  return [...new Set(values)];
}
