import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';

import type {
  CreateEmployeeDto,
  EmployeeAccountDto,
  UpdateEmployeeDto,
} from '@smart-restaurant/contracts';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

const employeePublicSelect = {
  id: true,
  firstname: true,
  lastname: true,
  role: true,
} satisfies Prisma.EmployeeSelect;

@Injectable()
export class EmployeesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.employee.findMany({
      orderBy: [{ lastname: 'asc' }, { firstname: 'asc' }],
      select: employeePublicSelect,
    });
  }

  findById(id: number) {
    return this.prisma.employee.findUnique({
      where: {
        id,
      },
      select: employeePublicSelect,
    });
  }

  async create({ email, password, ...employee }: CreateEmployeeDto) {
    const passwordHash = await hashPassword(password);
    return this.prisma.$transaction(async (tx) => {
      const userId = await this.createUser(
        tx,
        email,
        passwordHash,
        `${employee.firstname} ${employee.lastname}`,
      );
      return tx.employee.create({
        data: { ...employee, authUserId: userId },
        select: employeePublicSelect,
      });
    });
  }

  async provisionAccount(id: number, dto: EmployeeAccountDto) {
    const passwordHash = await hashPassword(dto.password);
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUniqueOrThrow({ where: { id } });
      if (employee.authUserId) return null;
      const userId = await this.createUser(
        tx,
        dto.email,
        passwordHash,
        `${employee.firstname} ${employee.lastname}`,
      );
      return tx.employee.update({
        where: { id },
        data: { authUserId: userId },
        select: employeePublicSelect,
      });
    });
  }

  update(id: number, dto: UpdateEmployeeDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.employee.findUniqueOrThrow({ where: { id } });
      if (current.role === 'ADMIN' && current.authUserId && dto.role && dto.role !== 'ADMIN') {
        await this.requireAnotherAdmin(tx, id);
      }
      const updated = await tx.employee.update({
        where: { id },
        data: dto,
        select: employeePublicSelect,
      });
      if (current.authUserId && (dto.firstname || dto.lastname)) {
        await tx.user.update({
          where: { id: current.authUserId },
          data: { name: `${updated.firstname} ${updated.lastname}` },
        });
      }
      return updated;
    });
  }

  remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.employee.findUniqueOrThrow({ where: { id } });
      if (current.role === 'ADMIN' && current.authUserId) {
        await this.requireAnotherAdmin(tx, id);
      }
      const deleted = await tx.employee.delete({
        where: { id },
        select: employeePublicSelect,
      });
      if (current.authUserId) {
        await tx.user.delete({ where: { id: current.authUserId } });
      }
      return deleted;
    });
  }

  private async requireAnotherAdmin(tx: Prisma.TransactionClient, id: number): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('smart-restaurant-admin-role'))`;
    const otherAdmins = await tx.employee.count({
      where: { id: { not: id }, role: 'ADMIN', authUserId: { not: null } },
    });
    if (otherAdmins === 0) {
      throw new ConflictException('The last active admin cannot be demoted or deleted');
    }
  }

  private async createUser(
    tx: Prisma.TransactionClient,
    email: string,
    passwordHash: string,
    name: string,
  ): Promise<string> {
    const userId = randomUUID();
    await tx.user.create({
      data: { id: userId, name, email: email.trim().toLowerCase() },
    });
    await tx.account.create({
      data: {
        id: randomUUID(),
        userId,
        accountId: userId,
        providerId: 'credential',
        password: passwordHash,
      },
    });
    return userId;
  }
}
