import { Injectable } from '@nestjs/common';
import { Propagation, TransactionHost, Transactional } from '@nestjs-cls/transactional';

import type { OrderStatus } from '@smart-restaurant/contracts';

import type { PrismaAdapter } from './transaction.js';

/**
 * Row locks that serialise writes to the same order or table session. Prisma
 * has no API for `SELECT ... FOR UPDATE`, so the two queries are raw SQL.
 *
 * Every write that depends on an order still being open takes the order's lock
 * first, and every write that depends on a session still being open takes the
 * session's lock first. Without them a check and the write it guards can
 * interleave with another request: an item added to an order that is being
 * closed, or an order placed in a session that is being cleared.
 *
 * Locks are always taken session before order, so two requests can never wait
 * on each other in opposite directions.
 */

export interface LockedOrder {
  id: number;
  status: OrderStatus;
  tableSessionId: number;
  employeeId: number | null;
}

export interface LockedTableSession {
  id: number;
  tableId: number;
  closedAt: Date | null;
}

@Injectable()
export class RowLocks {
  constructor(private readonly txHost: TransactionHost<PrismaAdapter>) {}

  /**
   * `Propagation.Mandatory`: outside a transaction the lock would be released
   * as soon as its statement finished, protecting nothing, so it throws
   * instead. The caller is missing `@Transactional()`.
   */
  @Transactional(Propagation.Mandatory)
  async order(id: number): Promise<LockedOrder | null> {
    const rows = await this.txHost.tx.$queryRaw<LockedOrder[]>`
      SELECT order_id AS id, status::text AS status, table_session_id AS "tableSessionId",
        employee_id AS "employeeId"
      FROM "Order"
      WHERE order_id = ${id}
      FOR UPDATE`;

    return rows[0] ?? null;
  }

  @Transactional(Propagation.Mandatory)
  async tableSession(id: number): Promise<LockedTableSession | null> {
    const rows = await this.txHost.tx.$queryRaw<LockedTableSession[]>`
      SELECT table_session_id AS id, table_id AS "tableId", closed_at AS "closedAt"
      FROM "Table_Session"
      WHERE table_session_id = ${id}
      FOR UPDATE`;

    return rows[0] ?? null;
  }
}
