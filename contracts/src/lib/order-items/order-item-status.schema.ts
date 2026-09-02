import { z } from 'zod';

/**
 * Mirrors the `OrderItemStatus` enum in `backend/prisma/schema.prisma`.
 * Kept as a plain Zod enum so the contracts package stays free of Prisma types
 * and can be consumed by the frontend.
 */
export const orderItemStatusSchema = z
  .enum(['OPEN', 'IN_PROGRESS', 'READY', 'SERVED', 'REMAKE'])
  .meta({
    id: 'OrderItemStatus',
    title: 'Order item status',
    description:
      'Kitchen workflow state of a single order item. The usual path is OPEN -> IN_PROGRESS -> READY -> SERVED, with REMAKE for an item that has to be made again. The API does not enforce an order between states.',
  });

export type OrderItemStatus = z.infer<typeof orderItemStatusSchema>;
