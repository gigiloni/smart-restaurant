import { z } from 'zod';

/**
 * Mirrors the `OrderItemStatus` enum in `backend/prisma/schema.prisma`.
 * Kept as a plain Zod enum so the contracts package stays free of Prisma types
 * and can be consumed by the frontend.
 *
 * Which status may follow which is enforced by the API; see
 * `order-item-transitions.ts` for the rules.
 */
export const orderItemStatusSchema = z
  .enum(['OPEN', 'IN_PROGRESS', 'READY', 'SERVED', 'REMAKE'])
  .meta({
    id: 'OrderItemStatus',
    title: 'Order item status',
    description:
      'Kitchen workflow state of a single order item. Items travel OPEN -> IN_PROGRESS -> READY -> SERVED, with REMAKE for an item that has to be made again. Not every status may follow every other: see the description of `PATCH /orders/{orderId}/items/{id}` for the permitted moves.',
  });

export type OrderItemStatus = z.infer<typeof orderItemStatusSchema>;
