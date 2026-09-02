import { z } from 'zod';

export const ingredientSchema = z
  .object({
    id: z.number().int().positive().meta({ description: 'Ingredient id.', example: 1 }),

    name: z.string().nullable().meta({
      description:
        'Ingredient name. Nullable in the database, so rows imported outside the API may have no name.',
      example: 'Mozzarella',
    }),
  })
  .meta({
    id: 'Ingredient',
    title: 'Ingredient',
    description: 'A raw ingredient that products are made from.',
  });

export type Ingredient = z.infer<typeof ingredientSchema>;
