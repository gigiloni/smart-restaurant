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
import { AccessService } from '../auth/access.service.js';
import type { AuthenticatedEmployee } from '../auth/auth.types.js';
import { Transactional } from '@nestjs-cls/transactional';

import { OrderLock, type OrderChange } from '../orders/order-lock.js';
import { OrdersService } from '../orders/orders.service.js';
import { OrderItemsRepository, type OrderItemWithDetails } from './order-items.repository.js';

@Injectable()
export class OrderItemsService {
  constructor(
    private readonly orderLock: OrderLock,
    private readonly orderItemsRepository: OrderItemsRepository,
    private readonly ordersService: OrdersService,
    private readonly access: AccessService,
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

  async create(
    orderId: number,
    dto: CreateOrderItemDto,
    by: OrderChange,
  ): Promise<OrderItemWithDetails> {
    try {
      return await this.addToOpenOrder(orderId, dto, by);
    } catch (error) {
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyConstraintViolation)) {
        throw new BadRequestException(`Product ${dto.productId} does not exist`);
      }

      throw error;
    }
  }

  /**
   * Holding the order's lock for the whole check-and-write means the item is
   * classified against the status it really has: a concurrent change either
   * finished before this one read the item, or waits until this one is done.
   */
  @Transactional()
  async update(
    orderId: number,
    id: number,
    dto: UpdateOrderItemDto,
    actor: AuthenticatedEmployee,
  ): Promise<OrderItemWithDetails> {
    // Anyone whose role may make this move may make it, owner or not.
    await this.orderLock.forChange(orderId);

    const orderItem = await this.orderItemsRepository.findByOrderAndId(orderId, id);

    if (!orderItem) {
      throw new NotFoundException(`Order item ${id} not found on order ${orderId}`);
    }

    this.access.requireStatusChange(actor, orderItem.product.type, dto.status);

    const kind = classifyOrderItemTransition(orderItem.status, dto.status, orderItem.product.type);

    if (kind === null) {
      throw new ConflictException(
        this.describeRejectedTransition(id, orderItem.status, dto.status, orderItem.product.type),
      );
    }

    // Re-sending the current status is accepted so a retried request is
    // safe, but there is nothing to write.
    if (kind === 'unchanged') {
      return orderItem;
    }

    const updated = await this.orderItemsRepository.updateWhenStatusIs(id, orderItem.status, dto);

    if (updated === null) {
      throw new ConflictException(
        `Order item ${id} was changed by another request while this one was in flight. ` +
          `Re-read the item and retry against its current status.`,
      );
    }

    return updated;
  }

  @Transactional()
  async remove(orderId: number, id: number, by: OrderChange): Promise<OrderItemWithDetails> {
    await this.orderLock.forChange(orderId, by);

    const orderItem = await this.orderItemsRepository.findByOrderAndId(orderId, id);

    if (!orderItem) {
      throw new NotFoundException(`Order item ${id} not found on order ${orderId}`);
    }

    return this.orderItemsRepository.remove(id);
  }

  @Transactional()
  private async addToOpenOrder(
    orderId: number,
    dto: CreateOrderItemDto,
    by: OrderChange,
  ): Promise<OrderItemWithDetails> {
    await this.orderLock.forChange(orderId, by);

    return this.orderItemsRepository.create(orderId, dto);
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
