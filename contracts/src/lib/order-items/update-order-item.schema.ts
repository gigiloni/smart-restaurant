import { z } from 'zod';

import { orderItemStatusSchema } from './order-item-status.schema.js';

/**
 * Order items are only ever moved through the kitchen workflow; the product an
 * item refers to is fixed once the item exists.
 */
export const updateOrderItemSchema = z.object({
  status: orderItemStatusSchema,
});

export type UpdateOrderItemDto = z.infer<typeof updateOrderItemSchema>;
