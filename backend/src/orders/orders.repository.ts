import { Injectable } from '@nestjs/common';

import type {
  CreateOrderDto,
  UpdateOrderDto,
} from '@smart-restaurant/contracts';

import {
  Prisma,
} from '../generated/prisma/client.js';

import { PrismaService } from '../database/prisma.service.js';

const orderDetailsInclude = {
  table: true,
  employee: true,

  orderItems: {
    include: {
      product: true,
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderWithDetails =
  Prisma.OrderGetPayload<{
    include: typeof orderDetailsInclude;
  }>;

@Injectable()
export class OrdersRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAll(): Promise<OrderWithDetails[]> {
    return this.prisma.order.findMany({
      include: orderDetailsInclude,

      orderBy: {
        id: 'desc',
      },
    });
  }

  async findById(
    id: number,
  ): Promise<OrderWithDetails | null> {
    return this.prisma.order.findUnique({
      where: {
        id,
      },

      include: orderDetailsInclude,
    });
  }

  async create({
    items,
    ...order
  }: CreateOrderDto): Promise<OrderWithDetails> {
    return this.prisma.order.create({
      data: {
        ...order,

        orderItems: items && {
          create: items,
        },
      },

      include: orderDetailsInclude,
    });
  }

  async update(
    id: number,
    dto: UpdateOrderDto,
  ): Promise<OrderWithDetails> {
    return this.prisma.order.update({
      where: {
        id,
      },

      data: dto,

      include: orderDetailsInclude,
    });
  }

  async remove(
    id: number,
  ): Promise<OrderWithDetails> {
    return this.prisma.order.delete({
      where: {
        id,
      },

      include: orderDetailsInclude,
    });
  }
}
