import { z } from 'zod';

import { productIngredientLineSchema } from './product-ingredient.schema.js';
import { productTypeSchema } from './product-type.schema.js';

const productFields = {
  id: z.number().int().positive().meta({ description: 'Product id.', example: 1 }),

  name: z.string().meta({ description: 'Menu name.', example: 'Pizza Margherita' }),

  description: z.string().nullable().meta({
    description: 'Menu description, or null when the product has none.',
    example: 'Tomato, mozzarella and basil',
  }),

  price: z.string().meta({
    description:
      'Price as a decimal string. The column is `numeric`, which is serialised as a string so no precision is lost in JSON.',
    example: '10.50',
  }),

  type: productTypeSchema,
};

/**
 * The product shape embedded in an order item, without its recipe.
 */
export const productSummarySchema = z.object(productFields).meta({
  id: 'ProductSummary',
  title: 'Product summary',
  description: 'A product without its recipe, as embedded in order items.',
});

export const productSchema = z
  .object({
    ...productFields,

    ingredients: z.array(productIngredientLineSchema).meta({
      description: 'The product recipe. Empty when no ingredients are recorded.',
    }),
  })
  .meta({
    id: 'Product',
    title: 'Product',
    description: 'A menu product together with its recipe.',
  });

export type Product = z.infer<typeof productSchema>;
export type ProductSummary = z.infer<typeof productSummarySchema>;
