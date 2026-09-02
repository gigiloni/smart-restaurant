import { z } from 'zod';

/**
 * Mirrors the `ProductType` enum in `backend/prisma/schema.prisma`.
 */
export const productTypeSchema = z.enum(['FOOD', 'DRINK', 'APPETIZER']).meta({
  id: 'ProductType',
  title: 'Product type',
  description: 'Menu category a product belongs to.',
});

export type ProductType = z.infer<typeof productTypeSchema>;
