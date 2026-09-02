import { z } from 'zod';

export const createTableSchema = z
  .object({
    tableNumber: z.number().int().positive().meta({
      description:
        'Number the table is known by. Must be unique: reusing an existing number fails on the unique index.',
      example: 7,
    }),

    seats: z
      .number()
      .int()
      .nonnegative()
      .default(0)
      .meta({ description: 'How many guests the table seats. Defaults to 0.', example: 4 }),
  })
  .meta({
    id: 'CreateTable',
    title: 'Create table',
    description: 'Payload for creating a table.',
  });

export type CreateTableDto = z.infer<typeof createTableSchema>;
