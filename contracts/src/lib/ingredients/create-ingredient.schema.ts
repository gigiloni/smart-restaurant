import { z } from 'zod';

export const ingredientInputSchema = z.object({
  name: z.string().trim().min(1).max(100).meta({
    description:
      'Ingredient name. Trimmed before validation; 1-100 characters, matching the `varchar(100)` column.',
    example: 'Mozzarella',
  }),
});

export const createIngredientSchema = ingredientInputSchema.meta({
  id: 'CreateIngredient',
  title: 'Create ingredient',
  description: 'Payload for creating an ingredient.',
});

export type CreateIngredientDto = z.infer<typeof createIngredientSchema>;
