import { z } from 'zod';

/**
 * One row of `Order_Item`. Each row is a single unit of a product, so quantity
 * is expressed by repeating the item rather than by a quantity column.
 *
 * The initial status is not part of the payload: items always start at OPEN and
 * reach any other status through `PATCH`, so the transition rules cannot be
 * side-stepped by creating an item that is already SERVED.
 */
export const createOrderItemSchema = z
  .object({
    productId: z.number().int().positive().meta({
      description: 'Id of an existing product. Unknown ids are rejected with 400.',
      example: 1,
    }),
  })
  .meta({
    id: 'CreateOrderItem',
    title: 'Create order item',
    description:
      'Payload for adding one item to an order. The item starts at OPEN. Add the same product twice to order two of it.',
  });

export type CreateOrderItemDto = z.infer<typeof createOrderItemSchema>;
