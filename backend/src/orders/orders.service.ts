import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  CreateOrderDto,
  UpdateOrderDto,
} from '@smart-restaurant/contracts';

import {
  OrdersRepository,
  type OrderWithDetails,
} from './repositories/orders.repository.js';

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
    return this.ordersRepository.create(dto);
  }

  async update(
    id: number,
    dto: UpdateOrderDto,
  ): Promise<OrderWithDetails> {
    await this.findOne(id);

    return this.ordersRepository.update(
      id,
      dto,
    );
  }

  async remove(
    id: number,
  ): Promise<OrderWithDetails> {
    await this.findOne(id);

    return this.ordersRepository.remove(id);
  }
}
