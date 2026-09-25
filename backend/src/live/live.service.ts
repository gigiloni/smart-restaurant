import { Injectable } from '@nestjs/common';

import type { Viewer } from '../auth/viewer.types.js';
import type { Db } from '../database/db.js';
import { PrismaService } from '../database/prisma.service.js';
import { orderDetailsInclude } from '../orders/orders.repository.js';
import { onlyStationItems, orderForGuest, stationProductTypes } from './live-scope.js';
import { OrderEventLog } from './order-event-log.js';

const sessionInclude = { table: true } as const;

@Injectable()
export class LiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly log: OrderEventLog,
  ) {}

  /**
   * What the viewer may see right now, and the id of the last event it
   * reflects.
   *
   * Read in one REPEATABLE READ transaction, the counter first. Writers bump
   * the counter while holding its row lock until they commit, so the snapshot
   * sees exactly the transactions behind events up to `cursor` and none after:
   * replaying the stream from `cursor` neither repeats nor misses a change.
   */
  snapshot(viewer: Viewer) {
    return this.prisma.$transaction(
      async (tx) => {
        const cursor = await this.log.head(tx);

        return { cursor, ...(await this.scopedState(tx, viewer)) };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  private async scopedState(db: Db, viewer: Viewer) {
    if (viewer.kind === 'guest') {
      const [sessions, orders] = await Promise.all([
        db.tableSession.findMany({ where: { id: viewer.tableSessionId }, include: sessionInclude }),
        db.order.findMany({
          where: { tableSessionId: viewer.tableSessionId },
          include: orderDetailsInclude,
          orderBy: { id: 'asc' },
        }),
      ]);

      return { sessions, orders: orders.map(orderForGuest) };
    }

    const station = stationProductTypes(viewer);

    if (!station) {
      const [sessions, orders] = await Promise.all([
        db.tableSession.findMany({
          where: { closedAt: null },
          include: sessionInclude,
          orderBy: { openedAt: 'asc' },
        }),
        db.order.findMany({
          where: { tableSession: { closedAt: null } },
          include: orderDetailsInclude,
          orderBy: { id: 'asc' },
        }),
      ]);

      return { sessions, orders };
    }

    const orders = await db.order.findMany({
      where: {
        status: 'OPEN',
        tableSession: { closedAt: null },
        orderItems: { some: { product: { type: { in: [...station] } } } },
      },
      include: orderDetailsInclude,
      orderBy: { id: 'asc' },
    });

    const sessions = await db.tableSession.findMany({
      where: { id: { in: [...new Set(orders.map((order) => order.tableSessionId))] } },
      include: sessionInclude,
      orderBy: { openedAt: 'asc' },
    });

    return { sessions, orders: orders.map((order) => onlyStationItems(order, station)) };
  }
}
