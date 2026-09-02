import { z } from 'zod';

import { orderItemStatusSchema } from './order-item-status.schema.js';

/**
 * Order items are only ever moved through the kitchen workflow; the product an
 * item refers to is fixed once the item exists.
 *
 * The payload only says where the item should go. Whether it may go there
 * depends on where it is now and what kind of product it is, and is checked by
 * the service against `order-item-transitions.ts`.
 */
export const updateOrderItemSchema = z
  .object({
    status: orderItemStatusSchema,
  })
  .meta({
    id: 'UpdateOrderItem',
    title: 'Update order item',
    description:
      'Moves an item to a new kitchen status. `status` is required. A move that is not permitted from the current status is rejected with 409, not 400: the payload is valid, the item is simply not in a state that allows it.',
  });

export type UpdateOrderItemDto = z.infer<typeof updateOrderItemSchema>;
