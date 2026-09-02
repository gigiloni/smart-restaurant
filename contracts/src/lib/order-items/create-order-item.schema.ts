import { z } from 'zod';

import { orderItemStatusSchema } from './order-item-status.schema.js';

/**
 * One row of `Order_Item`. Each row is a single unit of a product, so quantity
 * is expressed by repeating the item rather than by a quantity column.
 */
export const createOrderItemSchema = z.object({
  productId: z.number().int().positive(),
  status: orderItemStatusSchema.optional(),
});

export type CreateOrderItemDto = z.infer<typeof createOrderItemSchema>;
