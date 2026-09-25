import { z } from 'zod';

import { positiveInt32Schema } from '../common/integer.schema.js';

export const moveTableSessionSchema = z
  .object({
    tableId: positiveInt32Schema.meta({
      description: 'Id of the free table the party is moving to.',
      example: 2,
    }),
  })
  .meta({
    id: 'MoveTableSession',
    title: 'Move table session',
    description:
      'Moves a seated party, with every order they have placed, to another table. The target table must be free.',
  });

export type MoveTableSessionDto = z.infer<typeof moveTableSessionSchema>;
