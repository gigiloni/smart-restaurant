import { z } from 'zod';

import { orderInputSchema } from './create-order.schema.js';

/**
 * An order's table is no longer changed here: orders belong to a table session,
 * and a party that changes table moves as a whole through
 * `PATCH /table-sessions/{id}`.
 */
export const updateOrderSchema = z
  .object({
    employeeId: orderInputSchema.shape.employeeId,
  })
  .meta({
    id: 'UpdateOrder',
    title: 'Update order',
    description:
      'Reassigns an open order to another employee, or unassigns it with `null`. To move an order to another table, move its whole table session instead. Items are managed through `/orders/{orderId}/items`.',
  });

export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
