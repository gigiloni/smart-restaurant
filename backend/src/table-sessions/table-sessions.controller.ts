import { Body, Controller, Get, HttpCode, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  idParamSchema,
  moveTableSessionSchema,
  openTableSessionSchema,
  tableSessionDetailsSchema,
  tableSessionSchema,
  type MoveTableSessionDto,
  type OpenTableSessionDto,
} from '@smart-restaurant/contracts';

import { AccessService } from '../auth/access.service.js';
import type { AuthenticatedEmployee } from '../auth/auth.types.js';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import {
  ApiEntityConflictResponse,
  ApiEntityNotFoundResponse,
  ApiIdParam,
  ApiValidationErrorResponse,
} from '../swagger/api-docs.decorators.js';
import { TableSessionsService } from './table-sessions.service.js';

/** The part of the Fastify reply this controller touches, without depending on fastify directly. */
interface StatusReply {
  status(statusCode: number): unknown;
}

@ApiTags('Table sessions')
@Controller('table-sessions')
export class TableSessionsController {
  constructor(
    private readonly tableSessionsService: TableSessionsService,
    private readonly access: AccessService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List seated parties',
    description:
      'Returns every open table session — every table that currently has a party at it — oldest first. A table that does not appear here is free. Takes no query parameters.',
  })
  @ApiOkResponse({
    description: 'Every open table session, oldest first.',
    standardSchema: tableSessionSchema,
    isArray: true,
  })
  findOpen() {
    return this.tableSessionsService.findOpen();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one table session',
    description:
      'Returns a table session, open or closed, with every order placed during it. This is the whole bill for one party.',
  })
  @ApiIdParam('id', 'Id of the table session to return.')
  @ApiOkResponse({
    description: 'The requested session with its orders.',
    standardSchema: tableSessionDetailsSchema,
  })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No table session with that id exists.')
  findOne(@Param('id', { schema: idParamSchema }) id: number) {
    return this.tableSessionsService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Join or open a table session',
    description:
      'What a QR scan at a table does. If the table already has a seated party, their session is returned with 200; if the table is free, a new session is opened and returned with 201.\n\n' +
      'Safe to repeat: every guest scanning the same code lands in the same session, and two guests scanning at the same moment on a free table still end up sharing one.\n\n' +
      'Requires the SERVICE or ADMIN role.',
  })
  @ApiOkResponse({
    description: 'The table already had a seated party; this is their session.',
    standardSchema: tableSessionSchema,
  })
  @ApiCreatedResponse({
    description: 'The table was free; a new session has been opened.',
    standardSchema: tableSessionSchema,
  })
  @ApiValidationErrorResponse('The payload failed validation, or the table does not exist.')
  async open(
    @Body({ schema: openTableSessionSchema }) dto: OpenTableSessionDto,
    @Res({ passthrough: true }) reply: StatusReply,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.access.requireService(actor);

    const { session, created } = await this.tableSessionsService.openOrJoin(dto.tableId);

    reply.status(created ? 201 : 200);

    return session;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Move a party to another table',
    description:
      'Moves a seated party to a free table.\n\n' +
      "**Side effects:** every order in the session moves with it, open and closed, so each order's `tableId` changes to the new table. The old table becomes free.\n\n" +
      'Requires the SERVICE or ADMIN role.',
  })
  @ApiIdParam('id', 'Id of the table session to move.')
  @ApiOkResponse({
    description: 'The moved session with its orders.',
    standardSchema: tableSessionDetailsSchema,
  })
  @ApiValidationErrorResponse(
    '`id` is not a positive integer, the payload is invalid, or the target table does not exist.',
  )
  @ApiEntityNotFoundResponse('No table session with that id exists.')
  @ApiEntityConflictResponse(
    'The session has already been closed, or the target table already has a seated party.',
  )
  move(
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: moveTableSessionSchema }) dto: MoveTableSessionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.access.requireService(actor);

    return this.tableSessionsService.move(id, dto.tableId);
  }

  @Post(':id/close')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Clear the table',
    description:
      'Ends the session so the table is free for the next party. Every order in the session must already be closed — paid — first.\n\n' +
      '**Side effects:** the table becomes free, and anything bound to this session, such as guest access from the QR code, ends with it. Clearing an already cleared table is accepted and changes nothing, so a retried request is safe.\n\n' +
      'Requires the SERVICE or ADMIN role.',
  })
  @ApiIdParam('id', 'Id of the table session to close.')
  @ApiOkResponse({
    description: 'The closed session with its orders.',
    standardSchema: tableSessionDetailsSchema,
  })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No table session with that id exists.')
  @ApiEntityConflictResponse('At least one order in the session has not been paid yet.')
  close(
    @Param('id', { schema: idParamSchema }) id: number,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.access.requireService(actor);

    return this.tableSessionsService.close(id);
  }
}
