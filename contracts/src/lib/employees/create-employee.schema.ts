import { z } from 'zod';

import { employeeRoleSchema } from './employee-role.schema.js';

export const employeeInputSchema = z.object({
  firstname: z.string().trim().min(1).max(100).meta({
    description:
      'Given name. Trimmed before validation; 1-100 characters, matching the `varchar(100)` column.',
    example: 'Giulia',
  }),

  lastname: z.string().trim().min(1).max(100).meta({
    description:
      'Family name. Trimmed before validation; 1-100 characters, matching the `varchar(100)` column.',
    example: 'Ferrari',
  }),

  role: employeeRoleSchema,
});

export const createEmployeeSchema = employeeInputSchema.meta({
  id: 'CreateEmployee',
  title: 'Create employee',
  description:
    'Payload for adding a member of staff. Names are not required to be unique: two people may share one.',
});

export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
