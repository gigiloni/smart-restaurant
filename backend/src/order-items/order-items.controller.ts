import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  createOrderItemSchema,
  idParamSchema,
  orderItemSchema,
  updateOrderItemSchema,
  type CreateOrderItemDto,
  type UpdateOrderItemDto,
} from '@smart-restaurant/contracts';

import {
  ApiEntityNotFoundResponse,
  ApiIdParam,
  ApiValidationErrorResponse,
} from '../swagger/api-docs.decorators.js';
import { OrderItemsService } from './order-items.service.js';

/**
 * Order items are not a standalone resource: they only exist inside the order
 * that owns them, so every route is nested under `/orders/:orderId`.
 */
@ApiTags('Order items')
@Controller('orders/:orderId/items')
export class OrderItemsController {
  constructor(private readonly orderItemsService: OrderItemsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the items on an order',
    description:
      'Returns every item on the given order, oldest first, each with its product resolved. Takes no query parameters.',
  })
  @ApiIdParam('orderId', 'Id of the order whose items to list.')
  @ApiOkResponse({
    description: 'The items on this order, oldest first.',
    standardSchema: orderItemSchema,
    isArray: true,
  })
  @ApiValidationErrorResponse('`orderId` is not a positive integer.')
  @ApiEntityNotFoundResponse('No order with that id exists.')
  findAll(@Param('orderId', { schema: idParamSchema }) orderId: number) {
    return this.orderItemsService.findAll(orderId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one item on an order',
    description:
      'Returns a single item with its product resolved. The lookup is scoped to `orderId`, so an item belonging to a different order returns 404 rather than being readable through the wrong parent.',
  })
  @ApiIdParam('orderId', 'Id of the order the item belongs to.')
  @ApiIdParam('id', 'Id of the order item to return.')
  @ApiOkResponse({ description: 'The requested order item.', standardSchema: orderItemSchema })
  @ApiValidationErrorResponse('`orderId` or `id` is not a positive integer.')
  @ApiEntityNotFoundResponse('The order does not exist, or the item does not belong to it.')
  findOne(
    @Param('orderId', { schema: idParamSchema }) orderId: number,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.orderItemsService.findOne(orderId, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Add an item to an order',
    description:
      'Adds one unit of a product to the order.\n\n' +
      '**Side effects:** writes one `Order_Item` row, which then appears in `orderItems` on the parent order. Quantity is expressed by repeating the call — post the same `productId` twice to order two of it, since each row carries its own kitchen status.',
  })
  @ApiIdParam('orderId', 'Id of the order to add the item to.')
  @ApiCreatedResponse({
    description: 'The created order item, with its product resolved.',
    standardSchema: orderItemSchema,
  })
  @ApiValidationErrorResponse(
    '`orderId` is not a positive integer, the payload is invalid, or the referenced product does not exist.',
  )
  @ApiEntityNotFoundResponse('No order with that id exists.')
  create(
    @Param('orderId', { schema: idParamSchema }) orderId: number,
    @Body({ schema: createOrderItemSchema }) dto: CreateOrderItemDto,
  ) {
    return this.orderItemsService.create(orderId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Move an item to a new status',
    description:
      'Advances a single item through the kitchen workflow. `status` is required.\n\n' +
      'The API does not enforce an order between states, so any status may follow any other — a REMAKE can go straight back to IN_PROGRESS. The product an item refers to cannot be changed; delete the item and add a new one instead.',
  })
  @ApiIdParam('orderId', 'Id of the order the item belongs to.')
  @ApiIdParam('id', 'Id of the order item to update.')
  @ApiOkResponse({ description: 'The updated order item.', standardSchema: orderItemSchema })
  @ApiValidationErrorResponse(
    '`orderId` or `id` is not a positive integer, or `status` is missing or not a valid status.',
  )
  @ApiEntityNotFoundResponse('The order does not exist, or the item does not belong to it.')
  update(
    @Param('orderId', { schema: idParamSchema }) orderId: number,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateOrderItemSchema }) dto: UpdateOrderItemDto,
  ) {
    return this.orderItemsService.update(orderId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remove an item from an order',
    description:
      'Takes a single item off the order.\n\n' +
      '**Side effects:** deletes one `Order_Item` row. The order itself and the referenced product are untouched, and removing the last item leaves the order open with an empty `orderItems`.',
  })
  @ApiIdParam('orderId', 'Id of the order the item belongs to.')
  @ApiIdParam('id', 'Id of the order item to remove.')
  @ApiOkResponse({
    description: 'The removed order item, as it was immediately before deletion.',
    standardSchema: orderItemSchema,
  })
  @ApiValidationErrorResponse('`orderId` or `id` is not a positive integer.')
  @ApiEntityNotFoundResponse('The order does not exist, or the item does not belong to it.')
  remove(
    @Param('orderId', { schema: idParamSchema }) orderId: number,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.orderItemsService.remove(orderId, id);
  }
}
