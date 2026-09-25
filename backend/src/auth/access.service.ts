import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { ProductType } from '@smart-restaurant/contracts';

import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticatedEmployee } from './auth.types.js';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  requireAdmin(actor: AuthenticatedEmployee): void {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Admin role required');
    }
  }

  requireEmployee(actor: AuthenticatedEmployee, employeeId: number): void {
    if (actor.role !== 'ADMIN' && actor.id !== employeeId) {
      throw new ForbiddenException('Employees may access only their own profile');
    }
  }

  requireEmployeeUpdate(actor: AuthenticatedEmployee, employeeId: number, role?: string): void {
    this.requireEmployee(actor, employeeId);
    if (actor.role !== 'ADMIN' && role !== undefined) {
      throw new ForbiddenException('Only admins can assign roles');
    }
  }

  requireService(actor: AuthenticatedEmployee): void {
    if (actor.role !== 'SERVICE' && actor.role !== 'ADMIN') {
      throw new ForbiddenException('Service role required');
    }
  }

  async requireOrderOwner(actor: AuthenticatedEmployee, orderId: number): Promise<void> {
    if (actor.role === 'ADMIN') return;
    this.requireService(actor);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { employeeId: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    if (order.employeeId !== actor.id) {
      throw new ForbiddenException('Only the assigned employee can change this order');
    }
  }

  requireStatusChange(
    actor: AuthenticatedEmployee,
    productType: ProductType,
    target: string,
  ): void {
    if (actor.role === 'ADMIN') return;

    if (actor.role === 'SERVICE' && (target === 'SERVED' || target === 'REMAKE')) return;

    const preparationStatus = target === 'OPEN' || target === 'IN_PROGRESS' || target === 'READY';
    if (
      preparationStatus &&
      ((actor.role === 'KITCHEN' && (productType === 'FOOD' || productType === 'APPETIZER')) ||
        (actor.role === 'BAR' && productType === 'DRINK'))
    )
      return;

    throw new ForbiddenException('This role cannot set that status for this product type');
  }
}
