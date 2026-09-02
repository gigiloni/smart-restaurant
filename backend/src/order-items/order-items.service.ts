import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type { CreateOrderItemDto, UpdateOrderItemDto } from '@smart-restaurant/contracts';

import { PrismaErrorCode, isPrismaError } from '../database/prisma-error.js';
import { OrdersService } from '../orders/orders.service.js';
import { OrderItemsRepository, type OrderItemWithDetails } from './order-items.repository.js';

@Injectable()
export class OrderItemsService {
  constructor(
    private readonly orderItemsRepository: OrderItemsRepository,
    private readonly ordersService: OrdersService,
  ) {}

  async findAll(orderId: number): Promise<OrderItemWithDetails[]> {
    await this.ordersService.findOne(orderId);

    return this.orderItemsRepository.findAllByOrder(orderId);
  }

  async findOne(orderId: number, id: number): Promise<OrderItemWithDetails> {
    await this.ordersService.findOne(orderId);

    const orderItem = await this.orderItemsRepository.findByOrderAndId(orderId, id);

    if (!orderItem) {
      throw new NotFoundException(`Order item ${id} not found on order ${orderId}`);
    }

    return orderItem;
  }

  async create(orderId: number, dto: CreateOrderItemDto): Promise<OrderItemWithDetails> {
    await this.ordersService.findOne(orderId);

    try {
      return await this.orderItemsRepository.create(orderId, dto);
    } catch (error) {
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyConstraintViolation)) {
        throw new BadRequestException(`Product ${dto.productId} does not exist`);
      }

      throw error;
    }
  }

  async update(
    orderId: number,
    id: number,
    dto: UpdateOrderItemDto,
  ): Promise<OrderItemWithDetails> {
    await this.findOne(orderId, id);

    return this.orderItemsRepository.update(id, dto);
  }

  async remove(orderId: number, id: number): Promise<OrderItemWithDetails> {
    await this.findOne(orderId, id);

    return this.orderItemsRepository.remove(id);
  }
}
