import { z } from 'zod';

export const updateTableSchema = z.object({
  tableNumber: z
    .number()
    .int()
    .positive()
    .optional(),

  seats: z
    .number()
    .int()
    .nonnegative()
    .optional(),
});

export type UpdateTableDto =
  z.infer<typeof updateTableSchema>;
