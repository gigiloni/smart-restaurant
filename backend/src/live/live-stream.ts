import type { MessageEvent } from '@nestjs/common';
import type { LiveReady, LiveResync } from '@smart-restaurant/contracts';
import { Observable } from 'rxjs';

import type { Viewer } from '../auth/viewer.types.js';
import { scopeEvent } from './live-scope.js';
import type { FeedSignal, OrderEventFeed } from './order-event-feed.service.js';
import type { LoggedOrderEvent, OrderEventLog } from './order-event-log.js';

/** Keeps proxies and browsers from timing out a quiet stream. */
export const HEARTBEAT_MS = 15_000;

/** How often a connection re-checks the login or guest cookie that opened it. */
export const REVALIDATE_MS = 60_000;

/** Reconnect delay suggested to the browser. */
const RETRY_MS = 2_000;

export interface LiveStreamOptions {
  viewer: Viewer;

  /** The last event the client has applied. */
  since: number;

  feed: OrderEventFeed;
  log: OrderEventLog;

  /** Who the connection belongs to now, or null if they no longer may watch. */
  revalidate: () => Promise<Viewer | null>;
}

/**
 * One client's stream: every event after `since` that the viewer may see, in
 * order, then live ones as they commit.
 *
 * It subscribes to the shared feed before reading the backlog from the log,
 * holding live events back until the backlog is sent. Together the two cover
 * every id after `since`; an id the log already delivered is skipped when it
 * comes round again on the feed. Because ids have no gaps, `cursor + 1` is the
 * only acceptable next id: anything else means events were lost, and the
 * client is told to resync instead of silently missing them.
 *
 * The SSE `id:` of every message is the cursor, so a reconnecting browser's
 * `Last-Event-ID` resumes exactly here. Events the viewer may not see move the
 * cursor without being sent; the `ready` event carries it past them.
 */
export function liveStream(options: LiveStreamOptions): Observable<MessageEvent> {
  const { viewer, feed, log } = options;

  return new Observable<MessageEvent>((subscriber) => {
    let cursor = options.since;
    let caughtUp = false;
    let ended = false;
    const held: FeedSignal[] = [];

    const end = (resync?: LiveResync['reason']) => {
      if (ended) {
        return;
      }
      ended = true;

      if (resync) {
        const data: LiveResync = { reason: resync };
        subscriber.next({ type: 'resync', id: String(cursor), data });
      }
      subscriber.complete();
    };

    const deliver = (logged: LoggedOrderEvent) => {
      const { id } = logged.event;

      if (ended || id <= cursor) {
        return;
      }

      if (id !== cursor + 1) {
        end('cursor_expired');
        return;
      }

      cursor = id;
      const scoped = scopeEvent(viewer, logged);

      if (!scoped) {
        return;
      }

      subscriber.next({ type: scoped.type, id: String(id), data: scoped });

      // The party has left: nothing more will happen at this session, and the
      // guest cookie has stopped working, so a reconnect would only get 401.
      if (viewer.kind === 'guest' && scoped.type === 'session.closed') {
        end();
      }
    };

    const handle = (signal: FeedSignal) => {
      switch (signal.kind) {
        case 'event':
          deliver(signal.logged);
          break;
        case 'reset':
          end('log_reset');
          break;
        case 'shutdown':
          end();
          break;
      }
    };

    const subscription = feed.signals.subscribe((signal) =>
      caughtUp ? handle(signal) : held.push(signal),
    );

    const catchUp = async () => {
      const head = await log.head();

      if (cursor > head) {
        end('cursor_unknown');
        return;
      }

      while (cursor < head && !ended) {
        const page = await log.after(cursor);

        if (page.length === 0) {
          break;
        }
        page.forEach(deliver);
      }

      if (ended) {
        return;
      }

      // Committed events up to `head` are missing from the log: pruned.
      if (cursor < head) {
        end('cursor_expired');
        return;
      }

      caughtUp = true;
      held.splice(0).forEach(handle);

      if (!ended) {
        const data: LiveReady = { cursor };
        subscriber.next({ type: 'ready', id: String(cursor), retry: RETRY_MS, data });
      }
    };

    catchUp().catch((error: unknown) => subscriber.error(error));

    const heartbeat = setInterval(() => subscriber.next({ comment: 'heartbeat' }), HEARTBEAT_MS);

    const revalidation = setInterval(() => {
      options
        .revalidate()
        .then((current) => {
          if (!current) {
            end();
          } else if (!sameScope(current, viewer)) {
            end('scope_changed');
          }
        })
        .catch(() => undefined);
    }, REVALIDATE_MS);

    return () => {
      ended = true;
      subscription.unsubscribe();
      clearInterval(heartbeat);
      clearInterval(revalidation);
    };
  });
}

function sameScope(a: Viewer, b: Viewer): boolean {
  if (a.kind === 'staff' && b.kind === 'staff') {
    return a.employeeId === b.employeeId && a.role === b.role;
  }

  if (a.kind === 'guest' && b.kind === 'guest') {
    return a.tableSessionId === b.tableSessionId;
  }

  return false;
}
