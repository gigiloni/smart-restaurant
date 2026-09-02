import { z } from 'zod';

import { productSummarySchema } from '../products/product.schema.js';
import { orderItemStatusSchema } from './order-item-status.schema.js';

export const orderItemSchema = z
  .object({
    id: z.number().int().positive().meta({ description: 'Order item id.', example: 1 }),

    orderId: z
      .number()
      .int()
      .positive()
      .meta({ description: 'Id of the owning order.', example: 1 }),

    productId: z
      .number()
      .int()
      .positive()
      .meta({ description: 'Id of the ordered product.', example: 1 }),

    status: orderItemStatusSchema,

    product: productSummarySchema,
  })
  .meta({
    id: 'OrderItem',
    title: 'Order item',
    description:
      'One unit of a product on an order. Quantity is expressed by repeating the item, because `Order_Item` has no quantity column and each row carries its own status.',
  });

export type OrderItem = z.infer<typeof orderItemSchema>;
