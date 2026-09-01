import { z } from 'zod';

export const orderInputSchema = z.object({
  tableId: z
    .number()
    .int()
    .positive(),

  employeeId: z
    .number()
    .int()
    .positive()
    .nullable(),
});

export const createOrderSchema =
  orderInputSchema.extend({
    employeeId:
      orderInputSchema.shape.employeeId.optional(),
  });

export type CreateOrderDto =
  z.infer<typeof createOrderSchema>;
