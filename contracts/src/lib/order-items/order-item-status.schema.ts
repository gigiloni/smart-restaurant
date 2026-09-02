import { z } from 'zod';

/**
 * Mirrors the `OrderItemStatus` enum in `backend/prisma/schema.prisma`.
 * Kept as a plain Zod enum so the contracts package stays free of Prisma types
 * and can be consumed by the frontend.
 */
export const orderItemStatusSchema = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'READY',
  'SERVED',
  'REMAKE',
]);

export type OrderItemStatus = z.infer<typeof orderItemStatusSchema>;
