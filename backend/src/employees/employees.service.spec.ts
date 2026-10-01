import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { CreateEmployeeDto, EmployeeAccountDto } from '@smart-restaurant/contracts';

import { prismaError, stub } from '../../test/support/unit.js';
import type { EmployeesRepository } from './employees.repository.js';
import { EmployeesService } from './employees.service.js';

const service = (repository: object) => new EmployeesService(stub<EmployeesRepository>(repository));
const found = () => vi.fn().mockResolvedValue({ id: 1 });
const login: EmployeeAccountDto = { email: 'a@b.de', password: 'x'.repeat(12) };

describe('U-SV-EMP EmployeesService', () => {
  it('01 maps a taken email to 409', async () => {
    const employees = service({ create: vi.fn().mockRejectedValue(prismaError('P2002')) });

    await expect(employees.create(stub<CreateEmployeeDto>())).rejects.toThrow('Email is already in use');
  });

  it('02 refuses a second login for the same employee', async () => {
    const employees = service({ findById: found(), provisionAccount: vi.fn().mockResolvedValue(null) });

    await expect(employees.provisionAccount(1, login)).rejects.toThrow('already has a login');
  });

  it('03 answers 404 when adding a login to an unknown employee', async () => {
    const employees = service({ findById: vi.fn().mockResolvedValue(null) });

    await expect(employees.provisionAccount(1, login)).rejects.toThrow(NotFoundException);
  });

  it('04 maps an employee with orders on delete to 409', async () => {
    const employees = service({ findById: found(), remove: vi.fn().mockRejectedValue(prismaError('P2003')) });

    await expect(employees.remove(1)).rejects.toThrow('has taken at least one order');
  });

  it("05 passes the repository's last-admin conflict through", async () => {
    const lastAdmin = new ConflictException('The last active admin cannot be demoted or deleted');
    const employees = service({ findById: found(), remove: vi.fn().mockRejectedValue(lastAdmin) });

    await expect(employees.remove(1)).rejects.toBe(lastAdmin);
  });
});
