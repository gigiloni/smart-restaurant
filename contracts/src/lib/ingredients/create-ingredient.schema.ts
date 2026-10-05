import { z } from 'zod';

export const ingredientInputSchema = z.object({
  unit: z.enum(['g', 'ml', 'Stück']),
  stock: z.number().int().min(0).max(2147483647),
  name: z.string().trim().min(1).max(100).meta({
    description:
      'Ingredient name. Trimmed before validation; 1-100 characters, matching the `varchar(100)` column.',
    example: 'Mozzarella',
  }),
});

export const createIngredientSchema = ingredientInputSchema
  .extend({
    unit: ingredientInputSchema.shape.unit.default('g'),
    stock: ingredientInputSchema.shape.stock.default(0),
  })
  .meta({
    id: 'CreateIngredient',
    title: 'Create ingredient',
    description: 'Payload for creating an ingredient.',
  });

export type CreateIngredientDto = z.infer<typeof createIngredientSchema>;
