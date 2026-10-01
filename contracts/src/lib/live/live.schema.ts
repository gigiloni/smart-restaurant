import { z } from 'zod';

import { orderSchema } from '../orders/order.schema.js';
import { tableSessionSchema } from '../table-sessions/table-session.schema.js';

const cursorSchema = z.number().int().nonnegative().meta({
  description:
    'Id of the last order event reflected in this data, or 0 before the first. Open the live stream with `?since=` this value to receive exactly the changes that came after.',
  example: 0,
});

/**
 * Everything a client shows live, read in one consistent snapshot, and the
 * cursor to continue from over `GET /live/events`.
 */
export const liveSnapshotSchema = z
  .object({
    cursor: cursorSchema,

    sessions: z.array(tableSessionSchema).meta({
      description:
        'Seated parties the caller may see, oldest first. Service and admin: every open session. Kitchen and bar: the sessions of the orders below. Guests: their own session.',
    }),

    orders: z.array(orderSchema).meta({
      description:
        'Orders the caller may see, oldest first, with items oldest first. ' +
        'Service and admin: every order of every open session, paid ones included. ' +
        'Kitchen and bar: open orders with at least one item for their station, holding only those items. ' +
        'Guests: every order of their session, with `employeeId` and `employee` always null.',
    }),
  })
  .meta({
    id: 'LiveSnapshot',
    title: 'Live snapshot',
    description:
      'The live state of the restaurant as the caller may see it, and the event cursor it corresponds to.',
  });

export type LiveSnapshot = z.infer<typeof liveSnapshotSchema>;

export const liveEventsQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative().optional().meta({
    description:
      "The `cursor` of the snapshot the client holds. Required on the first connection; on a reconnect the browser's `Last-Event-ID` header takes precedence.",
    example: 0,
  }),
});

export type LiveEventsQuery = z.infer<typeof liveEventsQuerySchema>;

/** Data of the `ready` stream event, sent once the stream has caught up. */
export const liveReadySchema = z.object({ cursor: cursorSchema }).meta({
  id: 'LiveReady',
  title: 'Live stream ready',
  description:
    'Sent once every change since `since` has been delivered; from here on events arrive as they happen.',
});

export type LiveReady = z.infer<typeof liveReadySchema>;

/** Why the stream asks the client to start over. */
export const liveResyncReasonSchema = z
  .enum(['cursor_expired', 'cursor_unknown', 'scope_changed', 'log_reset'])
  .meta({
    id: 'LiveResyncReason',
    title: 'Resync reason',
    description:
      "`cursor_expired`: the changes since the cursor are no longer kept. `cursor_unknown`: the cursor is ahead of the log, usually because the database was reset. `scope_changed`: the caller's role changed while connected. `log_reset`: the event log was reset while connected.",
  });

/** Data of the `resync` stream event. */
export const liveResyncSchema = z.object({ reason: liveResyncReasonSchema }).meta({
  id: 'LiveResync',
  title: 'Live stream resync',
  description:
    "The stream cannot continue from the client's state. The server closes the stream after this event. Close the EventSource, fetch `GET /live/snapshot` again and reconnect with its cursor.",
});

export type LiveResync = z.infer<typeof liveResyncSchema>;
