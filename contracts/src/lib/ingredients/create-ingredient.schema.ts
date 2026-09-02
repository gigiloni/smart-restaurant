import { z } from 'zod';

export const ingredientInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const createIngredientSchema = ingredientInputSchema;

export type CreateIngredientDto = z.infer<typeof createIngredientSchema>;
