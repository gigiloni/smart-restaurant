import { Injectable } from '@nestjs/common';

import type {
  CreateOrderItemDto,
  OrderItemStatus,
  UpdateOrderItemDto,
} from '@smart-restaurant/contracts';

import type { Db } from '../database/db.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

const orderItemDetailsInclude = {
  product: true,
} satisfies Prisma.OrderItemInclude;

export type OrderItemWithDetails = Prisma.OrderItemGetPayload<{
  include: typeof orderItemDetailsInclude;
}>;

@Injectable()
export class OrderItemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByOrder(orderId: number): Promise<OrderItemWithDetails[]> {
    return this.prisma.orderItem.findMany({
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
  findByOrderAndId(
    orderId: number,
    id: number,
    db: Db = this.prisma,
  ): Promise<OrderItemWithDetails | null> {
    return db.orderItem.findFirst({
      where: {
        id,
        orderId,
      },

      include: orderItemDetailsInclude,
    });
  }

  create(orderId: number, dto: CreateOrderItemDto, db: Db): Promise<OrderItemWithDetails> {
    return db.orderItem.create({
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
    db: Db,
  ): Promise<OrderItemWithDetails | null> {
    const { count } = await db.orderItem.updateMany({
      where: {
        id,
        status: expectedStatus,
      },

      data: dto,
    });

    if (count === 0) {
      return null;
    }

    return db.orderItem.findUnique({
      where: {
        id,
      },

      include: orderItemDetailsInclude,
    });
  }

  remove(id: number, db: Db): Promise<OrderItemWithDetails> {
    return db.orderItem.delete({
      where: {
        id,
      },

      include: orderItemDetailsInclude,
    });
  }
}
