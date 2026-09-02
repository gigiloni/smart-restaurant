import { z } from 'zod';

/**
 * Mirrors the `EmployeeRole` enum in `backend/prisma/schema.prisma`.
 */
export const employeeRoleSchema = z.enum(['ADMIN', 'SERVICE', 'KITCHEN', 'BAR']).meta({
  id: 'EmployeeRole',
  title: 'Employee role',
  description: 'Role an employee fills in the restaurant.',
});

export type EmployeeRole = z.infer<typeof employeeRoleSchema>;
