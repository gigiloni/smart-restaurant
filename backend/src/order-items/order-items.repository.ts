import { Injectable } from '@nestjs/common';

import type {
  CreateOrderItemDto,
  OrderItemStatus,
  UpdateOrderItemDto,
} from '@smart-restaurant/contracts';

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
  findByOrderAndId(orderId: number, id: number): Promise<OrderItemWithDetails | null> {
    return this.prisma.orderItem.findFirst({
      where: {
        id,
        orderId,
      },

      include: orderItemDetailsInclude,
    });
  }

  create(orderId: number, dto: CreateOrderItemDto): Promise<OrderItemWithDetails> {
    return this.prisma.orderItem.create({
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
   * The permitted-transition check runs against the status the service read, so
   * an unguarded write would apply it even if another request moved the item in
   * between — producing a change no single transition allows. Matching on the
   * status makes the check and the write one atomic step, and a `null` return
   * means the item moved underneath this request.
   */
  async updateWhenStatusIs(
    id: number,
    expectedStatus: OrderItemStatus,
    dto: UpdateOrderItemDto,
  ): Promise<OrderItemWithDetails | null> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.orderItem.updateMany({
        where: {
          id,
          status: expectedStatus,
        },

        data: dto,
      });

      if (count === 0) {
        return null;
      }

      return tx.orderItem.findUnique({
        where: {
          id,
        },

        include: orderItemDetailsInclude,
      });
    });
  }

  remove(id: number): Promise<OrderItemWithDetails> {
    return this.prisma.orderItem.delete({
      where: {
        id,
      },

      include: orderItemDetailsInclude,
    });
  }
}
