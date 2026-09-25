import { Injectable } from '@nestjs/common';

import type { Db } from '../database/db.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { orderDetailsInclude } from '../orders/orders.repository.js';

const tableSessionInclude = {
  table: true,
} satisfies Prisma.TableSessionInclude;

const tableSessionDetailsInclude = {
  table: true,

  orders: {
    include: orderDetailsInclude,

    orderBy: {
      id: 'asc',
    },
  },
} satisfies Prisma.TableSessionInclude;

export type TableSessionWithTable = Prisma.TableSessionGetPayload<{
  include: typeof tableSessionInclude;
}>;

export type TableSessionWithDetails = Prisma.TableSessionGetPayload<{
  include: typeof tableSessionDetailsInclude;
}>;

@Injectable()
export class TableSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOpen(): Promise<TableSessionWithTable[]> {
    return this.prisma.tableSession.findMany({
      where: {
        closedAt: null,
      },

      include: tableSessionInclude,

      orderBy: {
        openedAt: 'asc',
      },
    });
  }

  findById(id: number, db: Db = this.prisma): Promise<TableSessionWithDetails | null> {
    return db.tableSession.findUnique({
      where: {
        id,
      },

      include: tableSessionDetailsInclude,
    });
  }

  findOpenByTable(tableId: number, db: Db = this.prisma): Promise<TableSessionWithTable | null> {
    return db.tableSession.findFirst({
      where: {
        tableId,
        closedAt: null,
      },

      include: tableSessionInclude,
    });
  }

  create(tableId: number, db: Db = this.prisma): Promise<TableSessionWithTable> {
    return db.tableSession.create({
      data: {
        tableId,
      },

      include: tableSessionInclude,
    });
  }

  /**
   * Orders follow automatically: their composite key onto the session cascades
   * the new table id.
   */
  move(id: number, tableId: number, db: Db): Promise<TableSessionWithTable> {
    return db.tableSession.update({
      where: {
        id,
      },

      data: {
        tableId,
      },

      include: tableSessionInclude,
    });
  }

  close(id: number, db: Db): Promise<TableSessionWithTable> {
    return db.tableSession.update({
      where: {
        id,
      },

      data: {
        closedAt: new Date(),
      },

      include: tableSessionInclude,
    });
  }

  countOpenOrders(id: number, db: Db): Promise<number> {
    return db.order.count({
      where: {
        tableSessionId: id,
        status: 'OPEN',
      },
    });
  }
}
