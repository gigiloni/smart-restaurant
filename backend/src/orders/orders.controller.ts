import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  createOrderSchema,
  DEFAULT_PAGE_SIZE,
  idParamSchema,
  MAX_PAGE_SIZE,
  orderSchema,
  paginationQuerySchema,
  updateOrderSchema,
  type CreateOrderDto,
  type PaginationQuery,
  type UpdateOrderDto,
} from '@smart-restaurant/contracts';

import { ForbiddenException } from '@nestjs/common';
import { AllowGuests } from '../auth/access-metadata.js';
import { AccessService } from '../auth/access.service.js';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { CurrentViewer } from '../auth/current-viewer.decorator.js';
import type { AuthenticatedEmployee } from '../auth/auth.types.js';
import type { Viewer } from '../auth/viewer.types.js';

import {
  ApiEntityConflictResponse,
  ApiEntityNotFoundResponse,
  ApiIdParam,
  ApiValidationErrorResponse,
} from '../swagger/api-docs.decorators.js';
import { OrdersService } from './orders.service.js';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly access: AccessService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List orders',
    description:
      'Returns one page of orders, newest first, each with its table, employee and items resolved.\n\n' +
      `Both paging parameters are optional: a request that omits them gets the newest ${DEFAULT_PAGE_SIZE} orders. Page through older ones by raising \`skip\`, which counts rows rather than pages — the second page of twenty is \`?take=20&skip=20\`.\n\n` +
      'The response is a plain array, so it carries no total. Ask for one more row than you intend to show to find out whether another page exists.\n\n' +
      'Ordering is by id descending and therefore stable, but an order created between two requests shifts the window by one row, so a row may repeat across pages.',
  })
  @ApiOkResponse({
    description: 'One page of orders, newest first.',
    standardSchema: orderSchema,
    isArray: true,
  })
  @ApiValidationErrorResponse(
    '`take` or `skip` is not an integer, `take` is outside 1 to ' +
      MAX_PAGE_SIZE +
      ', or `skip` is negative.',
  )
  findAll(@Query({ schema: paginationQuerySchema }) pagination: PaginationQuery) {
    return this.ordersService.findAll(pagination);
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
  @AllowGuests()
  @ApiOperation({
    summary: 'Open an order',
    description:
      'Opens an order at a table, optionally with its first items.\n\n' +
      '**Staff** (SERVICE, ADMIN): the order joins the party already seated there. If the table is free, a table session is opened for a new party first, exactly as a QR scan would. SERVICE staff are assigned the order themselves; only ADMIN may assign someone else or leave it unassigned.\n\n' +
      "**Guests** order for their own party only. `tableId` must be the party's current table (409 if they have moved or the table was cleared), `items` must hold at least one item, and `employeeId` must be absent or null: the order is created unassigned, and any SERVICE employee may take payment for it or claim it with `PATCH /orders/{id}`. A guest order never seats anyone.\n\n" +
      '**Side effects:** each entry in `items` writes one `Order_Item` row in the same transaction as the order, so an unknown product id fails the whole request and no order is created. Repeat a `productId` to order more than one of it. Every item starts at `OPEN` and is moved on through `/orders/{orderId}/items/{id}`.\n\n' +
      'An order may also be opened empty and filled later through `/orders/{orderId}/items`.',
  })
  @ApiCreatedResponse({
    description: 'The created order, with its table, employee and items resolved.',
    standardSchema: orderSchema,
  })
  @ApiValidationErrorResponse(
    'The payload failed validation, a referenced table, employee or product does not exist, or a guest sent no items.',
  )
  @ApiForbiddenResponse({
    description:
      'KITCHEN or BAR staff; SERVICE staff assigning someone else; a guest naming an employee.',
  })
  @ApiEntityConflictResponse(
    'Staff: the table was cleared twice while the order was being placed. A single clear is absorbed: the party has left, so the order seats the next party instead. Guests: the party is at another table, or has been cleared.',
  )
  create(
    @Body({ schema: createOrderSchema }) dto: CreateOrderDto,
    @CurrentViewer() viewer: Viewer,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    if (viewer.kind === 'guest') {
      return this.ordersService.createForGuest(viewer, dto);
    }

    this.access.requireService(actor);
    if (actor.role !== 'ADMIN') {
      if (dto.employeeId !== undefined && dto.employeeId !== actor.id) {
        throw new ForbiddenException('Service staff can only assign orders to themselves');
      }
      return this.ordersService.create({ ...dto, employeeId: actor.id });
    }
    return this.ordersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Reassign an order',
    description:
      'Assigns an open order to another employee, or unassigns it with `null`. Only ADMIN may do that.\n\n' +
      '**Claiming:** a SERVICE employee may assign an unassigned order — such as one a guest placed — to themselves by sending their own `employeeId`. If another employee claimed it first, the request fails with 409.\n\n' +
      'An order no longer changes table on its own: orders belong to the party at the table, and a party that moves takes every order with it through `PATCH /table-sessions/{id}`. Items are managed through `/orders/{orderId}/items`.',
  })
  @ApiIdParam('id', 'Id of the order to update.')
  @ApiOkResponse({ description: 'The updated order.', standardSchema: orderSchema })
  @ApiValidationErrorResponse(
    '`id` is not a positive integer, the payload is invalid, or the employee does not exist.',
  )
  @ApiEntityNotFoundResponse('No order with that id exists.')
  @ApiEntityConflictResponse(
    'The order is closed: it has been paid and is frozen. Or, when claiming, another employee took it first.',
  )
  async update(
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateOrderSchema }) dto: UpdateOrderDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    await this.access.requireOrderOwner(actor, id);
    if (actor.role !== 'ADMIN' && dto.employeeId !== undefined) {
      // SERVICE may only claim an unassigned order — typically a guest's — for themselves.
      if (dto.employeeId !== actor.id) {
        throw new ForbiddenException('Only admins can reassign orders');
      }
      return this.ordersService.update(id, dto, { claimFor: actor.id });
    }
    return this.ordersService.update(id, dto);
  }

  @Post(':id/close')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Close an order (take payment)',
    description:
      'Marks an order as paid. Everything on it must already have been served: an order cannot be paid while an item is still open, being made, waiting at the pass or being remade.\n\n' +
      '**Side effects:** the order is frozen. Its items can no longer be added, removed or moved through the kitchen workflow, and the order itself can no longer be reassigned or deleted. Once every order in a table session is closed, the table can be cleared.\n\n' +
      'Closing an already closed order is accepted and changes nothing, so a retried request is safe.\n\n' +
      'Only the service employee the order is assigned to, or an admin, may close it.',
  })
  @ApiIdParam('id', 'Id of the order to close.')
  @ApiOkResponse({ description: 'The closed order.', standardSchema: orderSchema })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No order with that id exists.')
  @ApiEntityConflictResponse('At least one item on the order has not been served yet.')
  async close(
    @Param('id', { schema: idParamSchema }) id: number,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    await this.access.requireOrderOwner(actor, id);

    return this.ordersService.close(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an order',
    description:
      'Deletes an open order outright. A closed order has been paid and cannot be deleted.\n\n' +
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
  @ApiEntityConflictResponse('The order is closed: it has been paid and is frozen.')
  async remove(
    @Param('id', { schema: idParamSchema }) id: number,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    await this.access.requireOrderOwner(actor, id);
    return this.ordersService.remove(id);
  }
}
