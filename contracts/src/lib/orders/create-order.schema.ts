import { z } from 'zod';

import { createOrderItemSchema } from '../order-items/create-order-item.schema.js';

export const orderInputSchema = z.object({
  tableId: z.number().int().positive(),

  employeeId: z.number().int().positive().nullable(),
});

/**
 * An order may be opened empty and filled later through
 * `/orders/:orderId/items`, or created with its first items in one call.
 */
export const createOrderSchema = orderInputSchema.extend({
  employeeId: orderInputSchema.shape.employeeId.optional(),

  items: z.array(createOrderItemSchema).optional(),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
