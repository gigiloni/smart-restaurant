import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  createTableSchema,
  idParamSchema,
  tableQrCodeSchema,
  tableSchema,
  updateTableSchema,
  type CreateTableDto,
  type UpdateTableDto,
} from '@smart-restaurant/contracts';

import { AccessService } from '../auth/access.service.js';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import type { AuthenticatedEmployee } from '../auth/auth.types.js';
import { GuestAccessService } from '../auth/guest-access.service.js';

import {
  ApiEntityConflictResponse,
  ApiEntityNotFoundResponse,
  ApiIdParam,
  ApiValidationErrorResponse,
} from '../swagger/api-docs.decorators.js';
import { TablesService } from './tables.service.js';

@ApiTags('Tables')
@Controller('tables')
export class TablesController {
  constructor(
    private readonly tablesService: TablesService,
    private readonly access: AccessService,
    private readonly guestAccess: GuestAccessService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all tables',
    description:
      'Returns every table, sorted by table number. Takes no query parameters: the list is neither filtered nor paginated.',
  })
  @ApiOkResponse({
    description: 'All tables, sorted by table number.',
    standardSchema: tableSchema,
    isArray: true,
  })
  findAll() {
    return this.tablesService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one table',
    description:
      'Returns a single table. Note that `id` is the primary key, not the `tableNumber` guests see.',
  })
  @ApiIdParam('id', 'Id of the table to return. This is the primary key, not the table number.')
  @ApiOkResponse({ description: 'The requested table.', standardSchema: tableSchema })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No table with that id exists.')
  findOne(@Param('id', { schema: idParamSchema }) id: number) {
    return this.tablesService.findOne(id);
  }

  @Get(':id/qr-code')
  @ApiOperation({
    summary: "Get a table's QR code content",
    description:
      'Returns what to encode in the QR code printed on this table. The guest app sends `tableId` and `token` to `POST /viewer/guest` to join the party seated there.\n\n' +
      'The token never changes, so a printed code keeps working. Anyone holding it can join whoever is seated at the table, which is why only staff can read it.\n\n' +
      'Requires the SERVICE or ADMIN role.',
  })
  @ApiIdParam('id', 'Id of the table.')
  @ApiOkResponse({ description: 'The QR code content.', standardSchema: tableQrCodeSchema })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No table with that id exists.')
  async qrCode(
    @Param('id', { schema: idParamSchema }) id: number,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.access.requireService(actor);

    const table = await this.tablesService.findOne(id);

    return {
      tableId: table.id,
      tableNumber: table.tableNumber,
      token: this.guestAccess.tableToken(table.id),
    };
  }

  @Post()
  @ApiOperation({
    summary: 'Create a table',
    description:
      'Adds a table to the restaurant. `tableNumber` is unique, so reusing an existing number is rejected with 409.',
  })
  @ApiCreatedResponse({ description: 'The created table.', standardSchema: tableSchema })
  @ApiValidationErrorResponse('The payload failed validation.')
  @ApiEntityConflictResponse('Another table already uses that table number.')
  create(
    @Body({ schema: createTableSchema }) dto: CreateTableDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.access.requireAdmin(actor);
    return this.tablesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a table',
    description:
      'Updates the fields present in the payload. At least one field is required. `tableNumber` must stay unique across all tables; taking a number another table already uses is rejected with 409.',
  })
  @ApiIdParam('id', 'Id of the table to update.')
  @ApiOkResponse({ description: 'The updated table.', standardSchema: tableSchema })
  @ApiValidationErrorResponse('`id` is not a positive integer, or the payload is empty or invalid.')
  @ApiEntityNotFoundResponse('No table with that id exists.')
  @ApiEntityConflictResponse('Another table already uses that table number.')
  update(
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateTableSchema }) dto: UpdateTableDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.access.requireAdmin(actor);
    return this.tablesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a table',
    description:
      'Removes a table.\n\n' +
      'A table that has orders against it is not deletable: orders reference their table, and nothing is cascaded away here.',
  })
  @ApiIdParam('id', 'Id of the table to delete.')
  @ApiOkResponse({
    description: 'The deleted table, as it was immediately before deletion.',
    standardSchema: tableSchema,
  })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No table with that id exists.')
  @ApiEntityConflictResponse('The table still has at least one order against it.')
  remove(
    @Param('id', { schema: idParamSchema }) id: number,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.access.requireAdmin(actor);
    return this.tablesService.remove(id);
  }
}
