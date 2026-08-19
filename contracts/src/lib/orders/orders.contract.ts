import { z } from 'zod';

export const OrderItemSchema = z.object({
  articleId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export type OrderItemDto = z.infer<typeof OrderItemSchema>;

export const CreateOrderSchema = z.object({
  tableId: z.string().uuid(),
  items: z.array(OrderItemSchema).min(1),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
