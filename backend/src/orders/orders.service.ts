import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  CreateOrderDto,
  UpdateOrderDto,
} from '@smart-restaurant/contracts';

import { PrismaErrorCode, isPrismaError } from '../database/prisma-error.js';
import {
  OrdersRepository,
  type OrderWithDetails,
} from './orders.repository.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async findAll(): Promise<OrderWithDetails[]> {
    return this.ordersRepository.findAll();
  }

  async findOne(
    id: number,
  ): Promise<OrderWithDetails> {
    const order =
      await this.ordersRepository.findById(id);

    if (!order) {
      throw new NotFoundException(
        `Order ${id} not found`,
      );
    }

    return order;
  }

  async create(
    dto: CreateOrderDto,
  ): Promise<OrderWithDetails> {
    try {
      return await this.ordersRepository.create(dto);
    } catch (error) {
      throw this.mapUnknownReference(error);
    }
  }

  async update(
    id: number,
    dto: UpdateOrderDto,
  ): Promise<OrderWithDetails> {
    await this.findOne(id);

    try {
      return await this.ordersRepository.update(
        id,
        dto,
      );
    } catch (error) {
      throw this.mapUnknownReference(error);
    }
  }

  async remove(
    id: number,
  ): Promise<OrderWithDetails> {
    await this.findOne(id);

    return this.ordersRepository.remove(id);
  }

  /**
   * An order points at a table, an employee and — through its items — at
   * products. A missing one of those is a bad payload, not a missing order.
   */
  private mapUnknownReference(error: unknown): unknown {
    if (
      isPrismaError(error, PrismaErrorCode.ForeignKeyConstraintViolation) ||
      isPrismaError(error, PrismaErrorCode.RecordNotFound)
    ) {
      return new BadRequestException(
        'One or more of the referenced table, employee or products do not exist',
      );
    }

    return error;
  }
}
