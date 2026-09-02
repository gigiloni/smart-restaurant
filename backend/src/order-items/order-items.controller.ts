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
  ApiEntityConflictResponse,
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
      '**Side effects:** writes one `Order_Item` row, which then appears in `orderItems` on the parent order. Quantity is expressed by repeating the call — post the same `productId` twice to order two of it, since each row carries its own kitchen status.\n\n' +
      'The item always starts at `OPEN`; the initial status is not part of the payload, so an item cannot be created into a state the transition rules would not have let it reach. Move it on with `PATCH`.',
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
      'Advances a single item through the kitchen workflow. `status` is required, and only some statuses may follow the one an item is already in.\n\n' +
      'Items travel along a chain, and a move is classified by where it lands on it:\n\n' +
      '```\n' +
      'OPEN  ──►  IN_PROGRESS  ──►  READY  ──►  SERVED\n' +
      '```\n\n' +
      '| Move | Meaning |\n' +
      '| --- | --- |\n' +
      '| **forward** | The next step along the chain. Always permitted. |\n' +
      '| **skip** | A forward jump past one or more steps. DRINK items only. |\n' +
      '| **undo** | Exactly one step back, to correct a mis-tap. Never more than one step. |\n' +
      '| **send-back** | READY or SERVED to REMAKE, when an item is rejected. |\n' +
      '| **remake** | REMAKE to IN_PROGRESS, when the kitchen starts the replacement. |\n' +
      '| **keep** | REMAKE to SERVED, when the guest accepts the item after all. |\n' +
      '| **unchanged** | Re-sending the current status. Accepted as a no-op, so a retried request is safe. |\n\n' +
      '### Which status may follow which\n\n' +
      'Rows are the status the item is in, columns the status requested. Cells marked *DRINK* are permitted only when the item refers to a DRINK product.\n\n' +
      '| from ↓ / to → | OPEN | IN_PROGRESS | READY | SERVED | REMAKE |\n' +
      '| --- | --- | --- | --- | --- | --- |\n' +
      '| **OPEN** | unchanged | forward | skip *(DRINK)* | skip *(DRINK)* | — |\n' +
      '| **IN_PROGRESS** | undo | unchanged | forward | skip *(DRINK)* | — |\n' +
      '| **READY** | — | undo | unchanged | forward | send-back |\n' +
      '| **SERVED** | — | — | undo | unchanged | send-back |\n' +
      '| **REMAKE** | — | remake | — | keep | unchanged |\n\n' +
      '### Drinks skip ahead\n\n' +
      'A bottle or a poured glass needs no preparation, so a DRINK item may jump forward to any later status: `OPEN` straight to `READY` or `SERVED`, or `IN_PROGRESS` straight to `SERVED`. FOOD and APPETIZER items have no way around `IN_PROGRESS` — they may only take the next step.\n\n' +
      '**Skipping is deliberately one-way.** `undo` remains a single step back for every product type, so a drink that jumped `OPEN` to `SERVED` unwinds through `READY` and `IN_PROGRESS` rather than returning to `OPEN` in one move. The asymmetry is intended: skipping ahead is a normal part of bar service, while a large rewind is more likely to be a mistake than an intent.\n\n' +
      '### Sending an item back\n\n' +
      'An item can only be rejected once it has been made, so `REMAKE` is reachable from `READY` (spotted at the pass) and `SERVED` (sent back by the guest), never from `OPEN` or `IN_PROGRESS` — an item still being prepared simply stays in preparation. A `REMAKE` resolves in one of two ways: to `IN_PROGRESS` when the kitchen starts the replacement, or to `SERVED` when the guest accepts the item after all.\n\n' +
      'The product an item refers to cannot be changed; delete the item and add a new one instead.',
  })
  @ApiIdParam('orderId', 'Id of the order the item belongs to.')
  @ApiIdParam('id', 'Id of the order item to update.')
  @ApiOkResponse({ description: 'The updated order item.', standardSchema: orderItemSchema })
  @ApiValidationErrorResponse(
    '`orderId` or `id` is not a positive integer, or `status` is missing or not a valid status.',
  )
  @ApiEntityNotFoundResponse('The order does not exist, or the item does not belong to it.')
  @ApiEntityConflictResponse(
    'The requested status may not follow the status the item is currently in. The message names the permitted targets, and says when a move was blocked only because the item is not a DRINK.',
  )
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
