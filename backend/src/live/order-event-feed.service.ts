import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import { Subject } from 'rxjs';

import { ORDER_EVENTS_CHANNEL } from '../order-events/order-events.writer.js';
import { OrderEventLog, type LoggedOrderEvent } from './order-event-log.js';

/** Read the log even without a notification this often, in case one was missed. */
const SAFETY_POLL_MS = 5_000;

/** Wait this long before reconnecting a dropped LISTEN connection. */
const RECONNECT_DELAY_MS = 1_000;

const PRUNE_INTERVAL_MS = 60 * 60 * 1_000;

/**
 * Something every open stream must react to.
 *
 * - `event`: the next event, in id order with no gaps.
 * - `reset`: the log went backwards — the database was reset — so every
 *   client's state is stale.
 * - `shutdown`: the server is stopping.
 */
export type FeedSignal =
  { kind: 'event'; logged: LoggedOrderEvent } | { kind: 'reset' } | { kind: 'shutdown' };

/**
 * The one reader of the order event log that every stream shares.
 *
 * Holds a dedicated connection that LISTENs for the writers' commit-time
 * notifications. A notification only says "something committed", so on each
 * one the feed reads everything after the last event it saw and publishes it.
 * However many clients are connected, that is one query per burst of commits.
 */
@Injectable()
export class OrderEventFeed implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderEventFeed.name);
  private readonly subject = new Subject<FeedSignal>();

  private listener: pg.Client | null = null;
  private lastSeen = 0;
  private reading: Promise<void> | null = null;
  private readAgain = false;
  private stopped = false;
  private timers: NodeJS.Timeout[] = [];

  /** Hot: subscribers get what is published after they subscribe. */
  readonly signals = this.subject.asObservable();

  constructor(
    private readonly log: OrderEventLog,
    private readonly config: ConfigService,
  ) {}

  /** Id of the last event published. Everything up to it has been published. */
  get position(): number {
    return this.lastSeen;
  }

  async onModuleInit(): Promise<void> {
    this.lastSeen = await this.log.head();
    await this.listen();

    this.timers.push(
      setInterval(() => this.poke(), SAFETY_POLL_MS),
      setInterval(() => void this.prune(), PRUNE_INTERVAL_MS),
    );
    void this.prune();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    this.timers.forEach(clearInterval);
    this.subject.next({ kind: 'shutdown' });
    this.subject.complete();
    await this.listener?.end().catch(() => undefined);
  }

  /** Reads the log now. Calls made while a read is running fold into one more read. */
  poke(): void {
    if (this.stopped) {
      return;
    }

    if (this.reading) {
      this.readAgain = true;
      return;
    }

    this.reading = this.readTail()
      .catch((error: unknown) => this.logger.error(`Reading order events failed: ${String(error)}`))
      .finally(() => {
        this.reading = null;

        if (this.readAgain) {
          this.readAgain = false;
          this.poke();
        }
      });
  }

  private async readTail(): Promise<void> {
    const head = await this.log.head();

    if (head < this.lastSeen) {
      this.logger.warn(
        `Order event log went back from ${this.lastSeen} to ${head}; resetting clients`,
      );
      this.lastSeen = head;
      this.subject.next({ kind: 'reset' });
      return;
    }

    while (this.lastSeen < head && !this.stopped) {
      const page = await this.log.after(this.lastSeen);

      for (const logged of page) {
        if (logged.event.id !== this.lastSeen + 1) {
          // Only pruning or a reset can do this; the feed is never that far behind.
          this.logger.warn(`Order event ${this.lastSeen + 1} is missing; resetting clients`);
          this.lastSeen = head;
          this.subject.next({ kind: 'reset' });
          return;
        }

        this.lastSeen = logged.event.id;
        this.subject.next({ kind: 'event', logged });
      }

      if (page.length === 0) {
        break;
      }
    }
  }

  private async listen(): Promise<void> {
    const client = new pg.Client({
      connectionString: this.config.getOrThrow<string>('database.url'),
    });

    client.on('notification', () => this.poke());
    client.on('error', (error) => {
      this.logger.warn(`LISTEN connection failed: ${error.message}`);
      void client.end().catch(() => undefined);
    });
    client.on('end', () => {
      if (this.listener === client) {
        this.listener = null;
        this.scheduleReconnect();
      }
    });

    try {
      await client.connect();
      await client.query(`LISTEN ${ORDER_EVENTS_CHANNEL}`);
    } catch (error) {
      this.logger.warn(`Could not LISTEN for order events: ${String(error)}`);
      await client.end().catch(() => undefined);
      this.scheduleReconnect();
      return;
    }

    this.listener = client;
    // Commits made while not listening sent notifications nobody heard.
    this.poke();
  }

  private scheduleReconnect(): void {
    if (this.stopped) {
      return;
    }

    const timer = setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== timer);
      void this.listen();
    }, RECONNECT_DELAY_MS);
    this.timers.push(timer);
  }

  private async prune(): Promise<void> {
    try {
      const deleted = await this.log.prune();

      if (deleted > 0) {
        this.logger.log(`Pruned ${deleted} order events`);
      }
    } catch (error) {
      this.logger.error(`Pruning order events failed: ${String(error)}`);
    }
  }
}
