import { z } from 'zod';

export const tableSchema = z
  .object({
    id: z.number().int().positive().meta({ description: 'Table id.', example: 1 }),

    tableNumber: z.number().int().positive().meta({
      description: 'Number the table is known by in the restaurant. Unique across all tables.',
      example: 7,
    }),

    seats: z.number().int().meta({ description: 'How many guests the table seats.', example: 4 }),
  })
  .meta({
    id: 'Table',
    title: 'Table',
    description: 'A table guests are seated at. Maps to the `Table` row.',
  });

export type Table = z.infer<typeof tableSchema>;
