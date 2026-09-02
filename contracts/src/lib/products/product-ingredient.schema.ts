import { z } from 'zod';

import { ingredientSchema } from '../ingredients/ingredient.schema.js';

/**
 * A single recipe line of `Product_Ingredient`. Product ingredients are not a
 * standalone resource: they are always written as part of their product.
 */
export const productIngredientSchema = z
  .object({
    ingredientId: z.number().int().positive().meta({
      description: 'Id of an existing ingredient. Unknown ids are rejected with 400.',
      example: 1,
    }),

    amount: z.number().int().nonnegative().default(0).meta({
      description: 'Quantity of the ingredient used, in whatever unit the kitchen works in.',
      example: 150,
    }),
  })
  .meta({
    id: 'ProductIngredientInput',
    title: 'Recipe line',
    description: 'One ingredient and its amount within a product recipe.',
  });

export type ProductIngredientDto = z.infer<typeof productIngredientSchema>;

/**
 * `Product_Ingredient` is keyed by (product_id, ingredient_id), so an ingredient
 * may only be listed once per product.
 */
export const productIngredientsSchema = z
  .array(productIngredientSchema)
  .refine((items) => new Set(items.map((item) => item.ingredientId)).size === items.length, {
    message: 'Each ingredient may only appear once per product',
  })
  .meta({
    title: 'Recipe',
    description:
      'The full recipe of a product. Each ingredient may appear at most once, because `Product_Ingredient` is keyed by (product_id, ingredient_id).',
  });

/**
 * A recipe line as it is returned, with the referenced ingredient resolved.
 */
export const productIngredientLineSchema = z
  .object({
    productId: z.number().int().positive().meta({ description: 'Owning product id.', example: 1 }),

    ingredientId: z
      .number()
      .int()
      .positive()
      .meta({ description: 'Referenced ingredient id.', example: 1 }),

    amount: z.number().int().meta({ description: 'Quantity used.', example: 150 }),

    ingredient: ingredientSchema,
  })
  .meta({
    id: 'ProductIngredient',
    title: 'Recipe line',
    description: 'A `Product_Ingredient` row with its ingredient resolved.',
  });

export type ProductIngredientLine = z.infer<typeof productIngredientLineSchema>;
