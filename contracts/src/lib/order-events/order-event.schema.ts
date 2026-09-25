import { z } from 'zod';

import { timestampSchema } from '../common/timestamp.schema.js';
import { orderItemStatusSchema } from '../order-items/order-item-status.schema.js';
import { orderItemSchema } from '../order-items/order-item.schema.js';
import { orderStatusSchema } from '../orders/order-status.schema.js';
import { orderSchema } from '../orders/order.schema.js';
import { tableSessionSchema } from '../table-sessions/table-session.schema.js';

/**
 * Every kind of change the live stream reports. Each is written in the same
 * transaction as the change it describes.
 */
export const orderEventTypeSchema = z
  .enum([
    'session.opened',
    'session.moved',
    'session.closed',
    'order.created',
    'order.updated',
    'order.closed',
    'order.deleted',
    'item.created',
    'item.status_changed',
    'item.deleted',
  ])
  .meta({
    id: 'OrderEventType',
    title: 'Order event type',
    description: 'What changed. Also the SSE `event:` field, so a client can listen per type.',
  });

export type OrderEventType = z.infer<typeof orderEventTypeSchema>;

/**
 * Enough of an item's order to render it on its own. A kitchen board may learn
 * of an item before — or without — ever seeing its order, for instance a dish
 * added to an order that until then held only drinks.
 */
export const orderEventOrderRefSchema = z
  .object({
    id: z.number().int().positive().meta({ description: 'Order id.' }),
    tableSessionId: z.number().int().positive().meta({ description: 'Table session id.' }),
    tableId: z.number().int().positive().meta({ description: 'Table id.' }),
    tableNumber: z.number().int().positive().meta({ description: 'Table number guests see.' }),
    status: orderStatusSchema,
  })
  .meta({
    id: 'OrderEventOrderRef',
    title: 'Order reference',
    description: 'The order an item belongs to, with its table, as carried by item events.',
  });

export type OrderEventOrderRef = z.infer<typeof orderEventOrderRefSchema>;

const envelope = {
  id: z.number().int().positive().meta({
    description:
      'Event id, and the SSE `id:` field. Ids increase in commit order with no event ever committing behind one already delivered, so the last id a client has applied is a complete cursor.',
  }),

  occurredAt: timestampSchema.meta({ description: 'When the change was committed.' }),
};

const sessionData = z.object({ session: tableSessionSchema });
const orderData = z.object({ order: orderSchema });
const itemData = z.object({ item: orderItemSchema, order: orderEventOrderRefSchema });

/**
 * One change, as stored and as delivered. `data` is always the full entity as
 * it was right after the change — or right before it, for deletions — so
 * applying an event is a replace, not a merge, and applying it twice is
 * harmless.
 */
export const orderEventSchema = z
  .discriminatedUnion('type', [
    z.object({ ...envelope, type: z.literal('session.opened'), data: sessionData }),
    z.object({
      ...envelope,
      type: z.literal('session.moved'),
      data: sessionData.extend({
        previousTableId: z.number().int().positive().meta({ description: 'Table the party left.' }),
      }),
    }),
    z.object({ ...envelope, type: z.literal('session.closed'), data: sessionData }),
    z.object({ ...envelope, type: z.literal('order.created'), data: orderData }),
    z.object({ ...envelope, type: z.literal('order.updated'), data: orderData }),
    z.object({ ...envelope, type: z.literal('order.closed'), data: orderData }),
    z.object({ ...envelope, type: z.literal('order.deleted'), data: orderData }),
    z.object({ ...envelope, type: z.literal('item.created'), data: itemData }),
    z.object({
      ...envelope,
      type: z.literal('item.status_changed'),
      data: itemData.extend({ previousStatus: orderItemStatusSchema }),
    }),
    z.object({ ...envelope, type: z.literal('item.deleted'), data: itemData }),
  ])
  .meta({
    id: 'OrderEvent',
    title: 'Order event',
    description:
      'One change to a table session, an order or an order item. Order events carry their items; items added later arrive as `item.created`. Deletions carry the entity as it was immediately before.',
  });

export type OrderEvent = z.infer<typeof orderEventSchema>;
