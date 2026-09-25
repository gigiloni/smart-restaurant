import { z } from 'zod';

import { timestampSchema } from '../common/timestamp.schema.js';
import { orderSchema } from '../orders/order.schema.js';
import { tableSchema } from '../tables/table.schema.js';

const tableSessionFields = {
  id: z.number().int().positive().meta({ description: 'Table session id.', example: 1 }),

  tableId: z.number().int().positive().meta({
    description: 'Id of the table the party is sitting at. Changes when the party moves.',
    example: 1,
  }),

  openedAt: timestampSchema.meta({
    description: 'When the session was opened, by the first QR scan or the first order.',
  }),

  closedAt: timestampSchema.nullable().meta({
    description:
      'When service cleared the table, or null while the party is still seated. A table has at most one session with no `closedAt`.',
  }),

  table: tableSchema,
};

/**
 * One party's time at a table. Returned wherever a session is listed.
 */
export const tableSessionSchema = z.object(tableSessionFields).meta({
  id: 'TableSession',
  title: 'Table session',
  description:
    "One party's time at a table, from the first QR scan until service clears the table. Every order belongs to a session.",
});

/**
 * A session together with every order placed during it.
 */
export const tableSessionDetailsSchema = z
  .object({
    ...tableSessionFields,

    orders: z.array(orderSchema).meta({
      description: 'Every order placed during this session, oldest first, open and closed.',
    }),
  })
  .meta({
    id: 'TableSessionDetails',
    title: 'Table session with orders',
    description: 'A table session together with every order placed during it.',
  });

export type TableSession = z.infer<typeof tableSessionSchema>;
export type TableSessionDetails = z.infer<typeof tableSessionDetailsSchema>;
