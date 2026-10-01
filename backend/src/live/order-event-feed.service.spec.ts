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
    after: vi.fn(async (cursor: number) => events.filter((e) => e.event.id > cursor)),
  };
  const subject = new OrderEventFeed(stub<OrderEventLog>(log), stub<ConfigService>());
  const published: FeedSignal[] = [];
  subject.signals.subscribe((signal) => published.push(signal));
  Object.assign(subject, { lastSeen });

  const internals = subject as unknown as { readTail(): Promise<void>; reading: Promise<void> | null };

  return { subject, log, published, readTail: () => internals.readTail(), internals };
}

describe('U-FD OrderEventFeed', () => {
  it('01 publishes new events in order and remembers how far it got', async () => {
    const f = feed(2, [logged(1), logged(2)]);
    await f.readTail();

    expect(f.published.map((s) => s.kind === 'event' && s.logged.event.id)).toEqual([1, 2]);
    expect(f.subject.position).toBe(2);
  });

  it('02 resets every client when the log went backwards', async () => {
    const f = feed(1, [], 5);
    await f.readTail();

    expect(f.published).toEqual([{ kind: 'reset' }]);
    expect(f.subject.position).toBe(1);
  });

  it('03 resets every client on a gap', async () => {
    const f = feed(3, [logged(2), logged(3)]);
    await f.readTail();

    expect(f.published).toEqual([{ kind: 'reset' }]);
  });

  it('04 folds pokes during a read into one more read', async () => {
    const f = feed(0, []);
    f.subject.poke();
    f.subject.poke();
    f.subject.poke();

    await vi.waitFor(() => expect(f.internals.reading).toBeNull());

    expect(f.log.head).toHaveBeenCalledTimes(2);
  });
});
