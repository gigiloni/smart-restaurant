import { z } from 'zod';

import { orderItemStatusSchema } from './order-item-status.schema.js';

/**
 * One row of `Order_Item`. Each row is a single unit of a product, so quantity
 * is expressed by repeating the item rather than by a quantity column.
 */
export const createOrderItemSchema = z
  .object({
    productId: z.number().int().positive().meta({
      description: 'Id of an existing product. Unknown ids are rejected with 400.',
      example: 1,
    }),

    status: orderItemStatusSchema
      .optional()
      .meta({ description: 'Initial status. Defaults to OPEN when omitted.' }),
  })
  .meta({
    id: 'CreateOrderItem',
    title: 'Create order item',
    description:
      'Payload for adding one item to an order. Add the same product twice to order two of it.',
  });

export type CreateOrderItemDto = z.infer<typeof createOrderItemSchema>;
