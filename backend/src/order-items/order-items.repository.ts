import { Injectable } from '@nestjs/common';

import type { CreateOrderItemDto, UpdateOrderItemDto } from '@smart-restaurant/contracts';

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

  update(id: number, dto: UpdateOrderItemDto): Promise<OrderItemWithDetails> {
    return this.prisma.orderItem.update({
      where: {
        id,
      },

      data: dto,

      include: orderItemDetailsInclude,
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
