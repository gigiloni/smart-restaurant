import { z } from 'zod';

import { nonNegativeInt32Schema, positiveInt32Schema } from '../common/integer.schema.js';

export const createTableSchema = z
  .object({
    tableNumber: positiveInt32Schema.meta({
      description:
        'Number the table is known by. Must be unique: reusing an existing number fails on the unique index.',
      example: 7,
    }),

    seats: nonNegativeInt32Schema
      .default(0)
      .meta({ description: 'How many guests the table seats. Defaults to 0.', example: 4 }),
  })
  .meta({
    id: 'CreateTable',
    title: 'Create table',
    description: 'Payload for creating a table.',
  });

export type CreateTableDto = z.infer<typeof createTableSchema>;
