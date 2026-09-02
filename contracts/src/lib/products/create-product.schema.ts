import { z } from 'zod';

import { productIngredientsSchema } from './product-ingredient.schema.js';
import { productTypeSchema } from './product-type.schema.js';

export const productInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(100).nullish(),
  price: z.number().nonnegative().finite(),
  type: productTypeSchema,
  ingredients: productIngredientsSchema.optional(),
});

export const createProductSchema = productInputSchema;

export type CreateProductDto = z.infer<typeof createProductSchema>;
