import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { CreateEmployeeDto, UpdateEmployeeDto } from '@smart-restaurant/contracts';

import { PrismaErrorCode, isPrismaError } from '../database/prisma-error.js';
import { EmployeesRepository } from './employees.repository.js';

@Injectable()
export class EmployeesService {
  constructor(private readonly employeesRepository: EmployeesRepository) {}

  findAll() {
    return this.employeesRepository.findAll();
  }

  async findOne(id: number) {
    const employee = await this.employeesRepository.findById(id);

    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    return employee;
  }

  create(dto: CreateEmployeeDto) {
    return this.employeesRepository.create(dto);
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    await this.findOne(id);

    return this.employeesRepository.update(id, dto);
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      return await this.employeesRepository.remove(id);
    } catch (error) {
      // Orders record who took them; that reference is not cascaded away, so an
      // employee who has taken an order stays on the books.
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyConstraintViolation)) {
        throw new ConflictException(`Employee ${id} has taken at least one order`);
      }

      throw error;
    }
  }
}
