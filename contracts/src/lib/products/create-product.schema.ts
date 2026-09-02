import { z } from 'zod';

import { productIngredientsSchema } from './product-ingredient.schema.js';
import { productTypeSchema } from './product-type.schema.js';

export const productInputSchema = z.object({
  name: z.string().trim().min(1).max(100).meta({
    description: 'Menu name. Trimmed before validation; 1-100 characters.',
    example: 'Pizza Margherita',
  }),

  description: z.string().trim().max(100).nullish().meta({
    description:
      'Menu description, up to 100 characters. Send `null` to clear it; omit the field to leave it unchanged.',
    example: 'Tomato, mozzarella and basil',
  }),

  price: z.number().nonnegative().finite().meta({
    description:
      'Price in euro, sent as a number. Read back as a decimal string, because the column is `numeric`.',
    example: 10.5,
  }),

  type: productTypeSchema,

  ingredients: productIngredientsSchema.optional(),
});

export const createProductSchema = productInputSchema.meta({
  id: 'CreateProduct',
  title: 'Create product',
  description:
    'Payload for creating a product. Passing `ingredients` creates the recipe in the same request; every referenced ingredient must already exist.',
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
