import { Injectable } from '@nestjs/common';

import type { Viewer } from '../auth/viewer.types.js';
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';

import type { PrismaAdapter } from '../database/transaction.js';
import { orderDetailsInclude } from '../orders/orders.repository.js';
import { onlyStationItems, orderForGuest, stationProductTypes } from './live-scope.js';
import { OrderEventLog } from './order-event-log.js';

const sessionInclude = { table: true } as const;

@Injectable()
export class LiveService {
  constructor(
    private readonly txHost: TransactionHost<PrismaAdapter>,
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
  @Transactional<PrismaAdapter>({ isolationLevel: 'RepeatableRead' })
  async snapshot(viewer: Viewer) {
    // First statement of the transaction, so it fixes the snapshot.
    const cursor = await this.log.head();

    return { cursor, ...(await this.scopedState(viewer)) };
  }

  /**
   * Queries run one after another: they share the transaction's single
   * connection, which cannot run two at once anyway.
   */
  private async scopedState(viewer: Viewer) {
    const db = this.txHost.tx;

    if (viewer.kind === 'guest') {
      const sessions = await db.tableSession.findMany({
        where: { id: viewer.tableSessionId },
        include: sessionInclude,
      });
      const orders = await db.order.findMany({
        where: { tableSessionId: viewer.tableSessionId },
        include: orderDetailsInclude,
        orderBy: { id: 'asc' },
      });

      return { sessions, orders: orders.map(orderForGuest) };
    }

    const station = stationProductTypes(viewer);

    if (!station) {
      const sessions = await db.tableSession.findMany({
        where: { closedAt: null },
        include: sessionInclude,
        orderBy: { openedAt: 'asc' },
      });
      const orders = await db.order.findMany({
        where: { tableSession: { closedAt: null } },
        include: orderDetailsInclude,
        orderBy: { id: 'asc' },
      });

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
