import { z } from 'zod';

/**
 * Mirrors the `ProductType` enum in `backend/prisma/schema.prisma`.
 */
export const productTypeSchema = z.enum(['FOOD', 'DRINK', 'APPETIZER']);

export type ProductType = z.infer<typeof productTypeSchema>;
