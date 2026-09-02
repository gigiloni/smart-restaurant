import { z } from 'zod';

import { AT_LEAST_ONE_FIELD_MESSAGE, hasAtLeastOneField } from '../common/refinements.js';
import { productInputSchema } from './create-product.schema.js';

/**
 * When `ingredients` is present the whole recipe is replaced; when it is absent
 * the existing recipe is left untouched.
 */
export const updateProductSchema = productInputSchema
  .partial()
  .refine(hasAtLeastOneField, {
    message: AT_LEAST_ONE_FIELD_MESSAGE,
  })
  .meta({
    id: 'UpdateProduct',
    title: 'Update product',
    description:
      'Partial payload for updating a product. Every field is optional, but the object must not be empty. Sending `ingredients` REPLACES the entire recipe: lines that are not in the array are deleted. Omit `ingredients` to leave the recipe untouched.',
  });

export type UpdateProductDto = z.infer<typeof updateProductSchema>;
