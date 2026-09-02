import { z } from 'zod';

import { createOrderItemSchema } from '../order-items/create-order-item.schema.js';

export const orderInputSchema = z.object({
  tableId: z.number().int().positive().meta({
    description: 'Id of an existing table. Unknown ids are rejected by the database.',
    example: 1,
  }),

  employeeId: z.number().int().positive().nullable().meta({
    description: 'Id of the employee taking the order. Send `null` for an unassigned order.',
    example: 1,
  }),
});

/**
 * An order may be opened empty and filled later through
 * `/orders/:orderId/items`, or created with its first items in one call.
 */
export const createOrderSchema = orderInputSchema
  .extend({
    employeeId: orderInputSchema.shape.employeeId.optional(),

    items: z.array(createOrderItemSchema).optional().meta({
      description:
        'Items to open the order with. Created in the same transaction as the order, so an unknown product id fails the whole request and no order is created.',
    }),
  })
  .meta({
    id: 'CreateOrder',
    title: 'Create order',
    description:
      'Payload for opening an order. `items` is optional: an order may be opened empty and filled later through `/orders/{orderId}/items`.',
  });

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
