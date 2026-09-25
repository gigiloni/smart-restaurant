import { z } from 'zod';

import { AT_LEAST_ONE_FIELD_MESSAGE, hasAtLeastOneField } from '../common/refinements.js';
import { employeeInputSchema } from './create-employee.schema.js';

export const updateEmployeeSchema = employeeInputSchema
  .partial()
  .refine(hasAtLeastOneField, {
    message: AT_LEAST_ONE_FIELD_MESSAGE,
  })
  .meta({
    id: 'UpdateEmployee',
    title: 'Update employee',
    description:
      'Partial payload for updating a member of staff. Every field is optional, but the object must not be empty. Changing a role takes effect immediately, including on orders the employee has already taken.',
  });

export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;
