import { z } from 'zod';

import { positiveInt32Schema } from '../common/integer.schema.js';
import { employeeRoleSchema } from '../employees/employee-role.schema.js';

/**
 * Who is making a request. Staff are identified by their login; guests by the
 * table session they joined with a QR code. What a viewer may see — on the live
 * stream in particular — follows from this alone.
 */
export const viewerSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('staff'),
      employeeId: z.number().int().positive().meta({ description: 'The signed-in employee.' }),
      role: employeeRoleSchema,
    }),
    z.object({
      kind: z.literal('guest'),
      tableSessionId: z
        .number()
        .int()
        .positive()
        .meta({ description: 'The table session the guest joined.' }),
      tableId: z
        .number()
        .int()
        .positive()
        .meta({ description: 'The table that session is at now.' }),
    }),
  ])
  .meta({
    id: 'Viewer',
    title: 'Viewer',
    description:
      'Who the request is from: a signed-in member of staff, or a guest seated at a table through its QR code.',
  });

export type Viewer = z.infer<typeof viewerSchema>;

export const enterAsGuestSchema = z
  .object({
    tableId: positiveInt32Schema.meta({
      description: 'The table the QR code belongs to.',
      example: 1,
    }),

    token: z.string().min(1).max(200).meta({
      description: 'The token printed in the QR code, proving the guest is at that table.',
    }),
  })
  .meta({
    id: 'EnterAsGuest',
    title: 'Enter as guest',
    description: 'What a table QR code carries.',
  });

export type EnterAsGuestDto = z.infer<typeof enterAsGuestSchema>;

export const tableQrCodeSchema = z
  .object({
    tableId: z.number().int().positive().meta({ description: 'Table id.' }),
    tableNumber: z.number().int().positive().meta({ description: 'Table number guests see.' }),
    token: z.string().meta({
      description:
        'Token to encode in the QR code together with `tableId`. It stays valid for as long as the server secret does: anyone who has it can join whoever is seated at the table.',
    }),
  })
  .meta({
    id: 'TableQrCode',
    title: 'Table QR code',
    description: 'What to print on a table so guests can join its session.',
  });

export type TableQrCode = z.infer<typeof tableQrCodeSchema>;
