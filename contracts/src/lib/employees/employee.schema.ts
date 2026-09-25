import { z } from 'zod';

import { employeeRoleSchema } from './employee-role.schema.js';

/**
 * A member of staff, as returned by `/employees` and as embedded in an order.
 */
export const employeeSchema = z
  .object({
    id: z.number().int().positive().meta({ description: 'Employee id.', example: 1 }),

    firstname: z.string().meta({ description: 'Given name.', example: 'Mara' }),

    lastname: z.string().meta({ description: 'Family name.', example: 'Keller' }),

    role: employeeRoleSchema,
  })
  .meta({
    id: 'Employee',
    title: 'Employee',
    description: 'A member of staff, who may be assigned to the orders they take.',
  });

export type Employee = z.infer<typeof employeeSchema>;
