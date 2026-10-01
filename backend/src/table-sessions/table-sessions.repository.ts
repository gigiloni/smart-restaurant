import { Injectable } from '@nestjs/common';

import { TransactionHost } from '@nestjs-cls/transactional';

import type { PrismaAdapter } from '../database/transaction.js';
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
  constructor(private readonly txHost: TransactionHost<PrismaAdapter>) {}

  /** The current transaction's client, or the plain client outside one. */
  private get db() {
    return this.txHost.tx;
  }

  findOpen(): Promise<TableSessionWithTable[]> {
    return this.db.tableSession.findMany({
      where: {
        closedAt: null,
      },

      include: tableSessionInclude,

      orderBy: {
        openedAt: 'asc',
      },
    });
  }

  findById(id: number): Promise<TableSessionWithDetails | null> {
    return this.db.tableSession.findUnique({
      where: {
        id,
      },

      include: tableSessionDetailsInclude,
    });
  }

  findOpenByTable(tableId: number): Promise<TableSessionWithTable | null> {
    return this.db.tableSession.findFirst({
      where: {
        tableId,
        closedAt: null,
      },

      include: tableSessionInclude,
    });
  }

  create(tableId: number): Promise<TableSessionWithTable> {
    return this.db.tableSession.create({
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
  move(id: number, tableId: number): Promise<TableSessionWithTable> {
    return this.db.tableSession.update({
      where: {
        id,
      },

      data: {
        tableId,
      },

      include: tableSessionInclude,
    });
  }

  close(id: number): Promise<TableSessionWithTable> {
    return this.db.tableSession.update({
      where: {
        id,
      },

      data: {
        closedAt: new Date(),
      },

      include: tableSessionInclude,
    });
  }

  countOpenOrders(id: number): Promise<number> {
    return this.db.order.count({
      where: {
        tableSessionId: id,
        status: 'OPEN',
      },
    });
  }
}
