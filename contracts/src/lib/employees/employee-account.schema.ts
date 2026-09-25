import { z } from 'zod';

export const employeeAccountSchema = z
  .object({
    email: z.email().max(254),
    password: z.string().min(12).max(128),
  })
  .meta({
    id: 'EmployeeAccount',
    title: 'Employee login',
    description: 'Credentials for an employee login. The password is never returned by the API.',
  });

export type EmployeeAccountDto = z.infer<typeof employeeAccountSchema>;
