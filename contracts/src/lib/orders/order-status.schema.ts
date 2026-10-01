import { z } from 'zod';

/**
 * Mirrors the `OrderStatus` enum in `backend/prisma/schema.prisma`.
 */
export const orderStatusSchema = z.enum(['OPEN', 'CLOSED']).meta({
  id: 'OrderStatus',
  title: 'Order status',
  description:
    'OPEN while guests can still add to the order; CLOSED once it has been paid. A closed order is frozen: items can no longer be added, removed or moved through the kitchen workflow, and the order can no longer be reassigned or deleted.',
});

export type OrderStatus = z.infer<typeof orderStatusSchema>;
