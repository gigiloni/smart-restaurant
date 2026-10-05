import { z } from 'zod';

import { AT_LEAST_ONE_FIELD_MESSAGE } from '../common/refinements.js';
import { ingredientInputSchema } from './create-ingredient.schema.js';

export const updateIngredientSchema = ingredientInputSchema
  .partial()
  .extend({ expectedStock: z.number().int().nonnegative().max(2147483647).optional() })
  .refine(
    ({ name, unit, stock }) => name !== undefined || unit !== undefined || stock !== undefined,
    {
      message: AT_LEAST_ONE_FIELD_MESSAGE,
    },
  )
  .meta({
    id: 'UpdateIngredient',
    title: 'Update ingredient',
    description:
      'Partial payload for updating an ingredient. Every field is optional, but the object must not be empty.',
  });

export type UpdateIngredientDto = z.infer<typeof updateIngredientSchema>;
