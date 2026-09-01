import { z } from 'zod';

import { orderInputSchema } from './create-order.schema.js';

export const updateOrderSchema = orderInputSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: 'At least one field must be provided',
    },
  );

export type UpdateOrderDto =
  z.infer<typeof updateOrderSchema>;
