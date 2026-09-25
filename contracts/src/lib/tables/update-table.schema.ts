import { z } from 'zod';

import { nonNegativeInt32Schema, positiveInt32Schema } from '../common/integer.schema.js';

import { AT_LEAST_ONE_FIELD_MESSAGE, hasAtLeastOneField } from '../common/refinements.js';

export const updateTableSchema = z
  .object({
    tableNumber: positiveInt32Schema.optional().meta({
      description: 'New table number. Must stay unique across all tables.',
      example: 7,
    }),

    seats: nonNegativeInt32Schema.optional().meta({ description: 'New seat count.', example: 6 }),
  })
  .refine(hasAtLeastOneField, {
    message: AT_LEAST_ONE_FIELD_MESSAGE,
  })
  .meta({
    id: 'UpdateTable',
    title: 'Update table',
    description:
      'Partial payload for updating a table. Every field is optional, but the object must not be empty.',
  });

export type UpdateTableDto = z.infer<typeof updateTableSchema>;
