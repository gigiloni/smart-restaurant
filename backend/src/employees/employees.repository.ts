import { Injectable } from '@nestjs/common';

import type { CreateEmployeeDto, UpdateEmployeeDto } from '@smart-restaurant/contracts';

import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class EmployeesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.employee.findMany({
      orderBy: [{ lastname: 'asc' }, { firstname: 'asc' }],
    });
  }

  findById(id: number) {
    return this.prisma.employee.findUnique({
      where: {
        id,
      },
    });
  }

  create(dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: dto,
    });
  }

  update(id: number, dto: UpdateEmployeeDto) {
    return this.prisma.employee.update({
      where: {
        id,
      },

      data: dto,
    });
  }

  remove(id: number) {
    return this.prisma.employee.delete({
      where: {
        id,
      },
    });
  }
}
