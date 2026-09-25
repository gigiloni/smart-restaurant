import type { OrderStatus } from '@smart-restaurant/contracts';

import type { Db } from './db.js';

/**
 * Row locks that serialise writes to the same order or table session.
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
}

export interface LockedTableSession {
  id: number;
  tableId: number;
  closedAt: Date | null;
}

export async function lockOrder(db: Db, id: number): Promise<LockedOrder | null> {
  const rows = await db.$queryRaw<LockedOrder[]>`
    SELECT order_id AS id, status::text AS status, table_session_id AS "tableSessionId"
    FROM "Order"
    WHERE order_id = ${id}
    FOR UPDATE`;

  return rows[0] ?? null;
}

export async function lockTableSession(db: Db, id: number): Promise<LockedTableSession | null> {
  const rows = await db.$queryRaw<LockedTableSession[]>`
    SELECT table_session_id AS id, table_id AS "tableId", closed_at AS "closedAt"
    FROM "Table_Session"
    WHERE table_session_id = ${id}
    FOR UPDATE`;

  return rows[0] ?? null;
}
