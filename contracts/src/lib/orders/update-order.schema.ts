import { z } from 'zod';

import { AT_LEAST_ONE_FIELD_MESSAGE, hasAtLeastOneField } from '../common/refinements.js';
import { orderInputSchema } from './create-order.schema.js';

export const updateOrderSchema = orderInputSchema
  .partial()
  .refine(hasAtLeastOneField, {
    message: AT_LEAST_ONE_FIELD_MESSAGE,
  })
  .meta({
    id: 'UpdateOrder',
    title: 'Update order',
    description:
      'Partial payload for reassigning an order to another table or employee. Items are not touched here: manage them through `/orders/{orderId}/items`.',
  });

export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
