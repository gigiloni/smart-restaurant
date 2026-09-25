import { Injectable } from '@nestjs/common';

import type {
  CreateOrderItemDto,
  PaginationQuery,
  UpdateOrderDto,
} from '@smart-restaurant/contracts';

import type { Db } from '../database/db.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

export const orderDetailsInclude = {
  table: true,
  employee: true,

  orderItems: {
    include: {
      product: true,
    },

    orderBy: {
      id: 'asc',
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderWithDetails = Prisma.OrderGetPayload<{
  include: typeof orderDetailsInclude;
}>;

export interface NewOrder {
  tableSessionId: number;
  tableId: number;
  employeeId?: number | null;
  items?: CreateOrderItemDto[];
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll({ take, skip }: PaginationQuery): Promise<OrderWithDetails[]> {
    return this.prisma.order.findMany({
      include: orderDetailsInclude,

      orderBy: {
        id: 'desc',
      },

      take,
      skip,
    });
  }

  findById(id: number, db: Db = this.prisma): Promise<OrderWithDetails | null> {
    return db.order.findUnique({
      where: {
        id,
      },

      include: orderDetailsInclude,
    });
  }

  create({ items, ...order }: NewOrder, db: Db): Promise<OrderWithDetails> {
    return db.order.create({
      data: {
        ...order,

        orderItems: items && {
          create: items,
        },
      },

      include: orderDetailsInclude,
    });
  }

  update(id: number, dto: UpdateOrderDto, db: Db): Promise<OrderWithDetails> {
    return db.order.update({
      where: {
        id,
      },

      data: dto,

      include: orderDetailsInclude,
    });
  }

  countUnservedItems(id: number, db: Db): Promise<number> {
    return db.orderItem.count({
      where: {
        orderId: id,
        status: {
          not: 'SERVED',
        },
      },
    });
  }

  close(id: number, db: Db): Promise<OrderWithDetails> {
    return db.order.update({
      where: {
        id,
      },

      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },

      include: orderDetailsInclude,
    });
  }

  remove(id: number, db: Db): Promise<OrderWithDetails> {
    return db.order.delete({
      where: {
        id,
      },

      include: orderDetailsInclude,
    });
  }
}
