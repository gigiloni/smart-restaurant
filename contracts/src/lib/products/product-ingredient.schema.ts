import { z } from 'zod';

/**
 * A single recipe line of `Product_Ingredient`. Product ingredients are not a
 * standalone resource: they are always written as part of their product.
 */
export const productIngredientSchema = z.object({
  ingredientId: z.number().int().positive(),
  amount: z.number().int().nonnegative().default(0),
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
  });
