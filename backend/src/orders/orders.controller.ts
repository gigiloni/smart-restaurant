import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { z } from 'zod';

import {
  createOrderSchema,
  updateOrderSchema,
  type CreateOrderDto,
  type UpdateOrderDto,
} from '@smart-restaurant/contracts';

import { OrdersService } from './orders.service.js';

const orderIdSchema = z.coerce
  .number()
  .int()
  .positive();

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
  ) {}

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id', {
      schema: orderIdSchema,
    })
    id: number,
  ) {
    return this.ordersService.findOne(id);
  }

  @Post()
  create(
    @Body({
      schema: createOrderSchema,
    })
    dto: CreateOrderDto,
  ) {
    return this.ordersService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', {
      schema: orderIdSchema,
    })
    id: number,

    @Body({
      schema: updateOrderSchema,
    })
    dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', {
      schema: orderIdSchema,
    })
    id: number,
  ) {
    return this.ordersService.remove(id);
  }
}
