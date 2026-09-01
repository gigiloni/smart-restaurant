import { z } from 'zod';

export const createTableSchema = z.object({
  tableNumber: z
    .number()
    .int()
    .positive(),

  seats: z
    .number()
    .int()
    .nonnegative()
    .default(0),
});

export type CreateTableDto =
  z.infer<typeof createTableSchema>;
