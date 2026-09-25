import { Injectable } from '@nestjs/common';

import type { OrderEventType, OrderItemStatus, ProductType } from '@smart-restaurant/contracts';

import type { Db } from '../database/db.js';
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
 * Appends order events inside the caller's transaction.
 *
 * Call it as the LAST write of a transaction. Bumping the counter takes a lock
 * on its single row that every event-writing transaction needs and that is only
 * released at commit, so whatever runs after the append runs while every other
 * writer in the restaurant waits.
 */
@Injectable()
export class OrderEventsWriter {
  sessionOpened(db: Db, session: SessionLike) {
    return this.append(db, {
      type: 'session.opened',
      tableSessionId: session.id,
      data: { session },
    });
  }

  async sessionMoved(db: Db, session: SessionLike, previousTableId: number) {
    return this.append(db, {
      type: 'session.moved',
      tableSessionId: session.id,
      productTypes: await this.openProductTypesOfSession(db, session.id),
      data: { session, previousTableId },
    });
  }

  sessionClosed(db: Db, session: SessionLike) {
    return this.append(db, {
      type: 'session.closed',
      tableSessionId: session.id,
      data: { session },
    });
  }

  orderCreated(db: Db, order: OrderLike) {
    return this.appendOrder(db, 'order.created', order);
  }

  orderUpdated(db: Db, order: OrderLike) {
    return this.appendOrder(db, 'order.updated', order);
  }

  orderClosed(db: Db, order: OrderLike) {
    return this.appendOrder(db, 'order.closed', order);
  }

  /** `order` is the order as it was immediately before deletion, items included. */
  orderDeleted(db: Db, order: OrderLike) {
    return this.appendOrder(db, 'order.deleted', order);
  }

  itemCreated(db: Db, item: ItemLike) {
    return this.appendItem(db, 'item.created', item);
  }

  itemStatusChanged(db: Db, item: ItemLike, previousStatus: OrderItemStatus) {
    return this.appendItem(db, 'item.status_changed', item, { previousStatus });
  }

  /** `item` is the item as it was immediately before deletion. */
  itemDeleted(db: Db, item: ItemLike) {
    return this.appendItem(db, 'item.deleted', item);
  }

  private appendOrder(db: Db, type: OrderEventType, order: OrderLike) {
    return this.append(db, {
      type,
      tableSessionId: order.tableSessionId,
      orderId: order.id,
      productTypes: distinct(order.orderItems.map((item) => item.product.type)),
      data: { order },
    });
  }

  private async appendItem(
    db: Db,
    type: OrderEventType,
    item: ItemLike,
    extra: Record<string, unknown> = {},
  ) {
    const order = await db.order.findUniqueOrThrow({
      where: { id: item.orderId },
      select: {
        id: true,
        tableSessionId: true,
        tableId: true,
        status: true,
        table: { select: { tableNumber: true } },
      },
    });

    return this.append(db, {
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

  private async append(db: Db, event: DraftOrderEvent): Promise<bigint> {
    // Row-locked counter rather than a sequence: see OrderEvent in schema.prisma.
    const [{ value: id }] = await db.$queryRaw<{ value: bigint }[]>`
      UPDATE "Order_Event_Counter" SET value = value + 1 WHERE id = 1 RETURNING value`;

    await db.orderEvent.create({
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
    await db.$executeRaw`SELECT pg_notify(${ORDER_EVENTS_CHANNEL}, '')`;

    return id;
  }

  private async openProductTypesOfSession(db: Db, tableSessionId: number): Promise<ProductType[]> {
    const items = await db.orderItem.findMany({
      where: { order: { tableSessionId, status: 'OPEN' } },
      select: { product: { select: { type: true } } },
    });

    return distinct(items.map((item) => item.product.type));
  }
}

function distinct<T>(values: T[]): T[] {
  return [...new Set(values)];
}
