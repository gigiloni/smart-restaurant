import { describe, expect, it } from 'vitest';

import { createEmployeeSchema } from './create-employee.schema.js';
import { employeeAccountSchema } from './employee-account.schema.js';
import { updateEmployeeSchema } from './update-employee.schema.js';

describe('U-CT-08 employee payloads', () => {
  const login = { email: 'a@b.de', password: 'x'.repeat(12) };

  it('accepts passwords of 12 to 128 characters', () => {
    expect(employeeAccountSchema.safeParse(login).success).toBe(true);
    expect(employeeAccountSchema.safeParse({ ...login, password: 'x'.repeat(128) }).success).toBe(true);
  });

  it.each([
    ['an 11-character password', { password: 'x'.repeat(11) }],
    ['a 129-character password', { password: 'x'.repeat(129) }],
    ['an invalid email', { email: 'nope' }],
  ])('rejects %s', (_, change) => {
    expect(employeeAccountSchema.safeParse({ ...login, ...change }).success).toBe(false);
  });

  it('requires a role on create', () => {
    expect(createEmployeeSchema.safeParse({ firstname: 'A', lastname: 'B', ...login }).success).toBe(false);
  });

  it('rejects an unknown role and an empty update', () => {
    expect(updateEmployeeSchema.safeParse({ role: 'CHEF' }).success).toBe(false);
    expect(updateEmployeeSchema.safeParse({}).success).toBe(false);
  });
});
