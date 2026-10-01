import { z } from 'zod';

import { positiveInt32Schema } from '../common/integer.schema.js';

export const openTableSessionSchema = z
  .object({
    tableId: positiveInt32Schema.meta({
      description: 'Id of the table to join or open a session at.',
      example: 1,
    }),
  })
  .meta({
    id: 'OpenTableSession',
    title: 'Open table session',
    description:
      'Joins the open session at a table, or opens one if the table is free. Safe to repeat: every guest scanning the same QR code lands in the same session.',
  });

export type OpenTableSessionDto = z.infer<typeof openTableSessionSchema>;
