import { Injectable } from '@nestjs/common';

import type {
  CreateOrderItemDto,
  OrderItemStatus,
  UpdateOrderItemDto,
} from '@smart-restaurant/contracts';

import { TransactionHost } from '@nestjs-cls/transactional';

import type { PrismaAdapter } from '../database/transaction.js';
import { Prisma } from '../generated/prisma/client.js';

const orderItemDetailsInclude = {
  product: true,
} satisfies Prisma.OrderItemInclude;

export type OrderItemWithDetails = Prisma.OrderItemGetPayload<{
  include: typeof orderItemDetailsInclude;
}>;

@Injectable()
export class OrderItemsRepository {
  constructor(private readonly txHost: TransactionHost<PrismaAdapter>) {}

  /** The current transaction's client, or the plain client outside one. */
  private get db() {
    return this.txHost.tx;
  }

  findAllByOrder(orderId: number): Promise<OrderItemWithDetails[]> {
    return this.db.orderItem.findMany({
      where: {
        orderId,
      },

      include: orderItemDetailsInclude,

      orderBy: {
        id: 'asc',
      },
    });
  }

  /**
   * Scoped by `orderId` so an item can never be read or written through the
   * wrong order.
   */
  findByOrderAndId(orderId: number, id: number): Promise<OrderItemWithDetails | null> {
    return this.db.orderItem.findFirst({
      where: {
        id,
        orderId,
      },

      include: orderItemDetailsInclude,
    });
  }

  create(orderId: number, dto: CreateOrderItemDto): Promise<OrderItemWithDetails> {
    return this.db.orderItem.create({
      data: {
        ...dto,
        orderId,
      },

      include: orderItemDetailsInclude,
    });
  }

  /**
   * Writes the new status only while the item is still in `expectedStatus`.
   *
   * Callers hold the parent order's row lock, which already stops another
   * request moving the item between the permitted-transition check and this
   * write. Matching on the status as well means a caller that forgot the lock
   * gets a `null` back rather than silently applying a move no transition
   * allows.
   */
  async updateWhenStatusIs(
    id: number,
    expectedStatus: OrderItemStatus,
    dto: UpdateOrderItemDto,
  ): Promise<OrderItemWithDetails | null> {
    const { count } = await this.db.orderItem.updateMany({
      where: {
        id,
        status: expectedStatus,
      },

      data: dto,
    });

    if (count === 0) {
      return null;
    }

    return this.db.orderItem.findUnique({
      where: {
        id,
      },

      include: orderItemDetailsInclude,
    });
  }

  remove(id: number): Promise<OrderItemWithDetails> {
    return this.db.orderItem.delete({
      where: {
        id,
      },

      include: orderItemDetailsInclude,
    });
  }
}
