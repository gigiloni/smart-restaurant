import { z } from 'zod';

import { timestampSchema } from '../common/timestamp.schema.js';
import { employeeSchema } from '../employees/employee.schema.js';
import { orderItemSchema } from '../order-items/order-item.schema.js';
import { tableSchema } from '../tables/table.schema.js';
import { orderStatusSchema } from './order-status.schema.js';

export const orderSchema = z
  .object({
    id: z.number().int().positive().meta({ description: 'Order id.', example: 1 }),

    tableSessionId: z.number().int().positive().meta({
      description: 'Id of the table session — the party at the table — the order belongs to.',
      example: 1,
    }),

    tableId: z.number().int().positive().meta({
      description:
        'Id of the table the order is served at. Always the table of its session, and follows the session when the party moves.',
      example: 1,
    }),

    status: orderStatusSchema,

    closedAt: timestampSchema.nullable().meta({
      description: 'When the order was paid, or null while it is still open.',
    }),

    employeeId: z.number().int().positive().nullable().meta({
      description: 'Id of the employee who took the order, or null when unassigned.',
      example: 1,
    }),

    table: tableSchema,

    employee: employeeSchema.nullable().meta({
      description: 'The employee who took the order, or null when unassigned.',
    }),

    orderItems: z.array(orderItemSchema).meta({
      description:
        'Items on this order, oldest first. Empty for an order that has just been opened.',
    }),
  })
  .meta({
    id: 'Order',
    title: 'Order',
    description: 'An order with its table, employee and items resolved.',
  });

export type Order = z.infer<typeof orderSchema>;
