import type { MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EmployeeRole, OrderEventType, ProductType } from '@smart-restaurant/contracts';

import { stub } from '../../test/support/unit.js';
import type { Viewer } from '../auth/viewer.types.js';
import { HEARTBEAT_MS, liveStream, REVALIDATE_MS } from './live-stream.js';
import type { FeedSignal, OrderEventFeed } from './order-event-feed.service.js';
import type { LoggedOrderEvent, OrderEventLog } from './order-event-log.js';

function logged(
  id: number,
  type: OrderEventType = 'item.created',
  options: { session?: number; productType?: ProductType } = {},
): LoggedOrderEvent {
  return {
    event: { id, occurredAt: '2026-10-01T00:00:00.000Z', type, data: {} } as LoggedOrderEvent['event'],
    tableSessionId: options.session ?? 2,
    productType: options.productType ?? 'FOOD',
    productTypes: [],
  };
}

const staff = (role: EmployeeRole): Viewer => ({ kind: 'staff', employeeId: 1, role });

/** A stream over a fake log holding `events`, with a hand-driven feed. */
function open(options: {
  since: number;
  head?: number;
  events?: LoggedOrderEvent[];
  viewer?: Viewer;
  revalidate?: () => Promise<Viewer | null>;
}) {
  const events = options.events ?? [];
  const signals = new Subject<FeedSignal>();
  const log = {
    head: vi.fn().mockResolvedValue(options.head ?? events.at(-1)?.event.id ?? 0),
    after: vi.fn(async (cursor: number) => events.filter((e) => e.event.id > cursor)),
  };
  const messages: MessageEvent[] = [];
  const state = { completed: false, error: undefined as unknown };

  const subscription = liveStream({
    viewer: options.viewer,
    since: options.since,
    feed: stub<OrderEventFeed>({ signals }),
    log: stub<OrderEventLog>(log),
    revalidate: options.revalidate ?? vi.fn(),
  }).subscribe({
    next: (message) => messages.push(message),
    complete: () => (state.completed = true),
    error: (error: unknown) => (state.error = error),
  });

  return { signals, log, messages, state, subscription };
}

const types = (messages: MessageEvent[]) => messages.map((m) => m.type);
const flush = () => vi.advanceTimersByTimeAsync(0);
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => logged(from + i));

describe('U-LST live stream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('01 sends the backlog in order, then ready with the cursor', async () => {
    const stream = open({ since: 1, events: range(1, 3) });
    await flush();

    expect(stream.messages.map((m) => [m.type, m.id])).toEqual([
      ['item.created', '2'],
      ['item.created', '3'],
      ['ready', '3'],
    ]);
    expect(stream.messages[2]).toMatchObject({ data: { cursor: 3 }, retry: 2000 });
    stream.subscription.unsubscribe();
  });

  it('02 asks for a resync when the cursor is ahead of the log', async () => {
    const stream = open({ since: 9, head: 3, events: range(1, 3) });
    await flush();

    expect(stream.messages).toEqual([{ type: 'resync', id: '9', data: { reason: 'cursor_unknown' } }]);
    expect(stream.state.completed).toBe(true);
  });

  it('03 asks for a resync when the backlog has been pruned', async () => {
    const stream = open({ since: 0, head: 5, events: range(3, 5) });
    await flush();

    expect(stream.messages.at(-1)).toMatchObject({ type: 'resync', data: { reason: 'cursor_expired' } });
    expect(stream.state.completed).toBe(true);
  });

  it('04 holds live events during catch-up and drops duplicates', async () => {
    const events = range(1, 2);
    const stream = open({ since: 0, events });
    stream.signals.next({ kind: 'event', logged: events[1] });
    stream.signals.next({ kind: 'event', logged: logged(3) });
    await flush();

    expect(stream.messages.map((m) => m.id)).toEqual(['1', '2', '3', '3']);
    expect(types(stream.messages)).toEqual(['item.created', 'item.created', 'item.created', 'ready']);
    stream.subscription.unsubscribe();
  });

  it('05 asks for a resync on a gap in the live feed', async () => {
    const stream = open({ since: 0 });
    await flush();
    stream.signals.next({ kind: 'event', logged: logged(2) });

    expect(stream.messages.at(-1)).toMatchObject({ type: 'resync', data: { reason: 'cursor_expired' } });
  });

  it('06 moves the cursor past events the viewer may not see', async () => {
    const stream = open({ since: 0, viewer: staff('BAR'), events: range(1, 2) });
    await flush();

    expect(stream.messages).toEqual([
      expect.objectContaining({ type: 'ready', id: '2', data: { cursor: 2 } }),
    ]);
    stream.subscription.unsubscribe();
  });

  it('07 resyncs on a log reset and simply ends on shutdown', async () => {
    const reset = open({ since: 0 });
    await flush();
    reset.signals.next({ kind: 'reset' });
    expect(reset.messages.at(-1)).toMatchObject({ type: 'resync', data: { reason: 'log_reset' } });
    expect(reset.state.completed).toBe(true);

    const shutdown = open({ since: 0 });
    await flush();
    shutdown.signals.next({ kind: 'shutdown' });
    expect(types(shutdown.messages)).toEqual(['ready']);
    expect(shutdown.state.completed).toBe(true);
  });

  it("08 ends a guest's stream after their table is cleared", async () => {
    const stream = open({
      since: 0,
      viewer: { kind: 'guest', tableSessionId: 2, tableId: 1 },
      events: [logged(1, 'session.closed', { session: 2 })],
    });
    await flush();

    expect(types(stream.messages)).toEqual(['session.closed']);
    expect(stream.state.completed).toBe(true);
  });

  it('09 sends a heartbeat comment every 15 seconds', async () => {
    const stream = open({ since: 0 });
    await flush();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);

    expect(stream.messages.filter((m) => m.comment === 'heartbeat')).toHaveLength(2);
    stream.subscription.unsubscribe();
  });

  it('10 re-checks the login every minute', async () => {
    const signedOut = open({ since: 0, viewer: staff('BAR'), revalidate: vi.fn().mockResolvedValue(null) });
    await flush();
    await vi.advanceTimersByTimeAsync(REVALIDATE_MS);
    expect(signedOut.state.completed).toBe(true);
    expect(types(signedOut.messages)).not.toContain('resync');

    const newRole = open({
      since: 0,
      viewer: staff('BAR'),
      revalidate: vi.fn().mockResolvedValue(staff('KITCHEN')),
    });
    await flush();
    await vi.advanceTimersByTimeAsync(REVALIDATE_MS);
    expect(newRole.messages.at(-1)).toMatchObject({ type: 'resync', data: { reason: 'scope_changed' } });

    const revalidate = vi.fn();
    const anonymous = open({ since: 0, revalidate });
    await flush();
    await vi.advanceTimersByTimeAsync(REVALIDATE_MS * 2);
    expect(revalidate).not.toHaveBeenCalled();
    anonymous.subscription.unsubscribe();
  });

  it('11 stops its timers and leaves the feed when unsubscribed', async () => {
    const stream = open({ since: 0 });
    await flush();
    stream.subscription.unsubscribe();
    const sent = stream.messages.length;
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 3);

    expect(stream.messages).toHaveLength(sent);
    expect(stream.signals.observed).toBe(false);
  });

  it('12 fails the stream when the log cannot be read', async () => {
    const failing = liveStream({
      viewer: undefined,
      since: 0,
      feed: stub<OrderEventFeed>({ signals: new Subject<FeedSignal>() }),
      log: stub<OrderEventLog>({ head: vi.fn().mockRejectedValue(new Error('database down')) }),
      revalidate: vi.fn(),
    });
    let error: unknown;
    const subscription = failing.subscribe({ error: (e: unknown) => (error = e) });
    await flush();

    expect((error as Error).message).toBe('database down');
    subscription.unsubscribe();
  });
});
