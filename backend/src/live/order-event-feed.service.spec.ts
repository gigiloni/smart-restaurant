import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { stub } from '../../test/support/unit.js';
import { OrderEventFeed, type FeedSignal } from './order-event-feed.service.js';
import type { LoggedOrderEvent, OrderEventLog } from './order-event-log.js';

const logged = (id: number) =>
  ({ event: { id }, tableSessionId: 1, productType: null, productTypes: [] }) as unknown as LoggedOrderEvent;

/** A feed over a fake log; `readTail` is what a notification or the safety poll triggers. */
function feed(head: number, events: LoggedOrderEvent[], lastSeen = 0) {
  const log = {
    head: vi.fn().mockResolvedValue(head),
    // Two per page, so the feed has to page through a longer tail.
    after: vi.fn(async (cursor: number) => events.filter((e) => e.event.id > cursor).slice(0, 2)),
  };
  const subject = new OrderEventFeed(stub<OrderEventLog>(log), stub<ConfigService>());
  const published: FeedSignal[] = [];
  let completed = false;
  subject.signals.subscribe({ next: (signal) => published.push(signal), complete: () => (completed = true) });
  Object.assign(subject, { lastSeen });

  const internals = subject as unknown as {
    readTail(): Promise<void>;
    reading: Promise<void> | null;
    logger: { error(message: string): void };
  };

  return {
    subject,
    log,
    published,
    internals,
    readTail: () => internals.readTail(),
    get completed() {
      return completed;
    },
  };
}

const ids = (signals: FeedSignal[]) => signals.map((s) => (s.kind === 'event' ? s.logged.event.id : s.kind));

describe('U-FD OrderEventFeed', () => {
  it('01 publishes new events in order, page by page, and remembers how far it got', async () => {
    const f = feed(5, [1, 2, 3, 4, 5].map(logged));
    await f.readTail();

    expect(ids(f.published)).toEqual([1, 2, 3, 4, 5]);
    expect(f.subject.position).toBe(5);
  });

  it('02 resets every client when the log went backwards', async () => {
    const f = feed(1, [], 5);
    await f.readTail();

    expect(f.published).toEqual([{ kind: 'reset' }]);
    expect(f.subject.position).toBe(1);
  });

  it('03 resets every client on a gap, then continues from the head', async () => {
    const f = feed(3, [logged(2), logged(3)]);
    await f.readTail();

    expect(f.published).toEqual([{ kind: 'reset' }]);
    expect(f.subject.position).toBe(3);
  });

  it('04 folds pokes during a read into one more read', async () => {
    const f = feed(0, []);
    f.subject.poke();
    f.subject.poke();
    f.subject.poke();

    await vi.waitFor(() => expect(f.internals.reading).toBeNull());

    expect(f.log.head).toHaveBeenCalledTimes(2);
  });

  it('05 logs a failed read and reads again on the next poke', async () => {
    const f = feed(0, []);
    const error = vi.spyOn(f.internals.logger, 'error').mockImplementation(() => undefined);
    f.log.head.mockRejectedValueOnce(new Error('database down'));

    f.subject.poke();
    await vi.waitFor(() => expect(f.internals.reading).toBeNull());
    f.subject.poke();
    await vi.waitFor(() => expect(f.internals.reading).toBeNull());

    expect(error).toHaveBeenCalledWith(expect.stringContaining('database down'));
    expect(f.log.head).toHaveBeenCalledTimes(2);
  });

  it('06 tells every stream it is shutting down, and stops reading', async () => {
    const f = feed(0, []);

    await f.subject.onModuleDestroy();
    f.subject.poke();

    expect(f.published).toEqual([{ kind: 'shutdown' }]);
    expect(f.completed).toBe(true);
    expect(f.log.head).not.toHaveBeenCalled();
  });
});
