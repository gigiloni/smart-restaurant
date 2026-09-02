import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  classifyOrderItemTransition,
  permittedOrderItemTargets,
  type CreateOrderItemDto,
  type OrderItemStatus,
  type ProductType,
  type UpdateOrderItemDto,
} from '@smart-restaurant/contracts';

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
    const orderItem = await this.findOne(orderId, id);

    const kind = classifyOrderItemTransition(orderItem.status, dto.status, orderItem.product.type);

    if (kind === null) {
      throw new ConflictException(
        this.describeRejectedTransition(id, orderItem.status, dto.status, orderItem.product.type),
      );
    }

    // Re-sending the current status is accepted so a retried request is safe,
    // but there is nothing to write.
    if (kind === 'unchanged') {
      return orderItem;
    }

    return this.orderItemsRepository.update(id, dto);
  }

  async remove(orderId: number, id: number): Promise<OrderItemWithDetails> {
    await this.findOne(orderId, id);

    return this.orderItemsRepository.remove(id);
  }

  /**
   * A move blocked only by the product type reads as arbitrary next to the
   * drink on the same ticket that is allowed it, so say which of the two it is.
   */
  private describeRejectedTransition(
    id: number,
    from: OrderItemStatus,
    to: OrderItemStatus,
    productType: ProductType,
  ): string {
    const blockedByProductType = classifyOrderItemTransition(from, to, 'DRINK') === 'skip';

    const reason = blockedByProductType
      ? `: only DRINK items may skip ahead, and this item is ${productType}`
      : '';

    const permitted = permittedOrderItemTargets(from, productType);

    return (
      `Order item ${id} cannot move from ${from} to ${to}${reason}. ` +
      `Permitted from ${from}: ${permitted.join(', ')}`
    );
  }
}
