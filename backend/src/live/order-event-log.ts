import { Injectable } from '@nestjs/common';

import type { OrderEvent, ProductType } from '@smart-restaurant/contracts';

import { TransactionHost } from '@nestjs-cls/transactional';

import type { PrismaAdapter } from '../database/transaction.js';

/**
 * An event as delivered, together with what decides who may see it. The
 * routing fields never leave the server.
 */
export interface LoggedOrderEvent {
  event: OrderEvent;
  tableSessionId: number;
  productType: ProductType | null;
  productTypes: ProductType[];
}

/** Events read per query while catching up. */
export const LOG_PAGE_SIZE = 500;

/** How long events are kept for clients to catch up from. */
export const LOG_RETENTION_HOURS = 24;

/**
 * Reads the order event log written by `OrderEventsWriter`.
 *
 * Ids have no gaps: each comes from a counter bumped in the writing
 * transaction, which a rollback undoes, and events are only ever pruned from
 * the oldest end. So an id that is not exactly one past the previous means
 * events were lost to the reader — pruned, or the log reset — never merely
 * late.
 */
@Injectable()
export class OrderEventLog {
  constructor(private readonly txHost: TransactionHost<PrismaAdapter>) {}

  /**
   * The current transaction's client — the snapshot's, when called from it —
   * or the plain client, as for the background feed.
   */
  private get db() {
    return this.txHost.tx;
  }

  /** Id of the newest committed event, or 0 before the first. */
  async head(): Promise<number> {
    const counter = await this.db.orderEventCounter.findUniqueOrThrow({ where: { id: 1 } });

    return Number(counter.value);
  }

  /** Up to `LOG_PAGE_SIZE` committed events after `cursor`, oldest first. */
  async after(cursor: number): Promise<LoggedOrderEvent[]> {
    const rows = await this.db.orderEvent.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: 'asc' },
      take: LOG_PAGE_SIZE,
    });

    return rows.map((row) => ({
      event: {
        id: Number(row.id),
        occurredAt: row.occurredAt.toISOString(),
        type: row.type,
        data: row.payload,
      } as OrderEvent,
      tableSessionId: row.tableSessionId,
      productType: row.productType,
      productTypes: row.productTypes,
    }));
  }

  /**
   * Drops events older than the retention window. Deletes a prefix by id
   * rather than by time: `occurredAt` is when a transaction started, so it is
   * not ordered by id, and deleting by time alone could leave a hole.
   */
  async prune(): Promise<number> {
    return this.db.$executeRaw`
      DELETE FROM "Order_Event"
      WHERE order_event_id <= (
        SELECT max(order_event_id) FROM "Order_Event"
        WHERE occurred_at < now() - make_interval(hours => ${LOG_RETENTION_HOURS})
      )`;
  }
}
