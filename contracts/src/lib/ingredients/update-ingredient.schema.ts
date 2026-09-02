import { z } from 'zod';

import { AT_LEAST_ONE_FIELD_MESSAGE, hasAtLeastOneField } from '../common/refinements.js';
import { ingredientInputSchema } from './create-ingredient.schema.js';

export const updateIngredientSchema = ingredientInputSchema
  .partial()
  .refine(hasAtLeastOneField, {
    message: AT_LEAST_ONE_FIELD_MESSAGE,
  })
  .meta({
    id: 'UpdateIngredient',
    title: 'Update ingredient',
    description:
      'Partial payload for updating an ingredient. Every field is optional, but the object must not be empty.',
  });

export type UpdateIngredientDto = z.infer<typeof updateIngredientSchema>;
