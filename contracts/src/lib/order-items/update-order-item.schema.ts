import { z } from 'zod';

import { orderItemStatusSchema } from './order-item-status.schema.js';

/**
 * Order items are only ever moved through the kitchen workflow; the product an
 * item refers to is fixed once the item exists.
 */
export const updateOrderItemSchema = z
  .object({
    status: orderItemStatusSchema,
  })
  .meta({
    id: 'UpdateOrderItem',
    title: 'Update order item',
    description:
      'Moves an item to a new kitchen status. `status` is required; the product an item refers to cannot be changed, so remove the item and add a new one instead.',
  });

export type UpdateOrderItemDto = z.infer<typeof updateOrderItemSchema>;
