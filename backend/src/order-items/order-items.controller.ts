import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import {
  createOrderItemSchema,
  idParamSchema,
  updateOrderItemSchema,
  type CreateOrderItemDto,
  type UpdateOrderItemDto,
} from '@smart-restaurant/contracts';

import { OrderItemsService } from './order-items.service.js';

/**
 * Order items are not a standalone resource: they only exist inside the order
 * that owns them, so every route is nested under `/orders/:orderId`.
 */
@Controller('orders/:orderId/items')
export class OrderItemsController {
  constructor(private readonly orderItemsService: OrderItemsService) {}

  @Get()
  findAll(@Param('orderId', { schema: idParamSchema }) orderId: number) {
    return this.orderItemsService.findAll(orderId);
  }

  @Get(':id')
  findOne(
    @Param('orderId', { schema: idParamSchema }) orderId: number,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.orderItemsService.findOne(orderId, id);
  }

  @Post()
  create(
    @Param('orderId', { schema: idParamSchema }) orderId: number,
    @Body({ schema: createOrderItemSchema }) dto: CreateOrderItemDto,
  ) {
    return this.orderItemsService.create(orderId, dto);
  }

  @Patch(':id')
  update(
    @Param('orderId', { schema: idParamSchema }) orderId: number,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateOrderItemSchema }) dto: UpdateOrderItemDto,
  ) {
    return this.orderItemsService.update(orderId, id, dto);
  }

  @Delete(':id')
  remove(
    @Param('orderId', { schema: idParamSchema }) orderId: number,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.orderItemsService.remove(orderId, id);
  }
}
