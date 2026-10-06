import { Injectable } from '@nestjs/common';

import type {
  CreateOrderItemDto,
  PaginationQuery,
  UpdateOrderDto,
} from '@smart-restaurant/contracts';

import { TransactionHost } from '@nestjs-cls/transactional';

import type { PrismaAdapter } from '../database/transaction.js';
import { Prisma } from '../generated/prisma/client.js';

export const orderDetailsInclude = {
  table: true,
  employee: { select: { id: true, firstname: true, lastname: true, role: true } },

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
  guestId?: string;
  tableSessionId: number;
  tableId: number;
  employeeId?: number | null;
  items?: CreateOrderItemDto[];
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly txHost: TransactionHost<PrismaAdapter>) {}

  /** The current transaction's client, or the plain client outside one. */
  private get db() {
    return this.txHost.tx;
  }

  findAll(
    { take, skip }: PaginationQuery,
    where?: Prisma.OrderWhereInput,
  ): Promise<OrderWithDetails[]> {
    return this.db.order.findMany({
      where,
      include: orderDetailsInclude,

      orderBy: {
        id: 'desc',
      },

      take,
      skip,
    });
  }

  findById(id: number): Promise<OrderWithDetails | null> {
    return this.db.order.findUnique({
      where: {
        id,
      },

      include: orderDetailsInclude,
    });
  }

  create({ items, ...order }: NewOrder): Promise<OrderWithDetails> {
    return this.db.order.create({
      data: {
        ...order,

        orderItems: items && {
          create: items,
        },
      },

      include: orderDetailsInclude,
    });
  }

  update(id: number, dto: UpdateOrderDto): Promise<OrderWithDetails> {
    return this.db.order.update({
      where: {
        id,
      },

      data: dto,

      include: orderDetailsInclude,
    });
  }

  async tableNumberOf(tableId: number): Promise<number> {
    const table = await this.db.restaurantTable.findUniqueOrThrow({
      where: {
        id: tableId,
      },

      select: {
        tableNumber: true,
      },
    });

    return table.tableNumber;
  }

  countUnservedItems(id: number): Promise<number> {
    return this.db.orderItem.count({
      where: {
        orderId: id,
        status: {
          not: 'SERVED',
        },
      },
    });
  }

  close(id: number): Promise<OrderWithDetails> {
    return this.db.order.update({
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

  remove(id: number): Promise<OrderWithDetails> {
    return this.db.order.delete({
      where: {
        id,
      },

      include: orderDetailsInclude,
    });
  }
}
