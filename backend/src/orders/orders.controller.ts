import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  createOrderSchema,
  idParamSchema,
  orderSchema,
  updateOrderSchema,
  type CreateOrderDto,
  type UpdateOrderDto,
} from '@smart-restaurant/contracts';

import {
  ApiEntityNotFoundResponse,
  ApiIdParam,
  ApiValidationErrorResponse,
} from '../swagger/api-docs.decorators.js';
import { OrdersService } from './orders.service.js';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'List all orders',
    description:
      'Returns every order, newest first, each with its table, employee and items resolved. Takes no query parameters: the list is neither filtered nor paginated.',
  })
  @ApiOkResponse({
    description: 'All orders, newest first.',
    standardSchema: orderSchema,
    isArray: true,
  })
  findAll() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one order',
    description:
      'Returns a single order with its table, employee and items resolved. Each item carries its own kitchen status.',
  })
  @ApiIdParam('id', 'Id of the order to return.')
  @ApiOkResponse({ description: 'The requested order.', standardSchema: orderSchema })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No order with that id exists.')
  findOne(@Param('id', { schema: idParamSchema }) id: number) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Open an order',
    description:
      'Opens an order on a table, optionally with its first items.\n\n' +
      '**Side effects:** each entry in `items` writes one `Order_Item` row in the same transaction as the order, so an unknown product id fails the whole request and no order is created. Repeat a `productId` to order more than one of it.\n\n' +
      'An order may also be opened empty and filled later through `/orders/{orderId}/items`.',
  })
  @ApiCreatedResponse({
    description: 'The created order, with its table, employee and items resolved.',
    standardSchema: orderSchema,
  })
  @ApiValidationErrorResponse(
    'The payload failed validation, or a referenced table, employee or product does not exist.',
  )
  create(@Body({ schema: createOrderSchema }) dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Reassign an order',
    description:
      'Moves an order to another table or employee. At least one field is required.\n\n' +
      'Items are not touched here — add, update and remove them through `/orders/{orderId}/items`.',
  })
  @ApiIdParam('id', 'Id of the order to update.')
  @ApiOkResponse({ description: 'The updated order.', standardSchema: orderSchema })
  @ApiValidationErrorResponse(
    '`id` is not a positive integer, the payload is empty or invalid, or a referenced table or employee does not exist.',
  )
  @ApiEntityNotFoundResponse('No order with that id exists.')
  update(
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateOrderSchema }) dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an order',
    description:
      'Deletes an order outright.\n\n' +
      '**Side effects:** every `Order_Item` row on this order is cascaded away with it, whatever kitchen status those items are in. The referenced table, employee and products are not touched.',
  })
  @ApiIdParam('id', 'Id of the order to delete.')
  @ApiOkResponse({
    description:
      'The deleted order, as it was immediately before deletion, including the items that were removed with it.',
    standardSchema: orderSchema,
  })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No order with that id exists.')
  remove(@Param('id', { schema: idParamSchema }) id: number) {
    return this.ordersService.remove(id);
  }
}
