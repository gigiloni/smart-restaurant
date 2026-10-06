import { Body, Controller, ForbiddenException, Get, Post, Res } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  enterAsGuestSchema,
  openTableSessionSchema,
  tableSessionSchema,
  viewerSchema,
  type EnterAsGuestDto,
  type OpenTableSessionDto,
} from '@smart-restaurant/contracts';

import { CurrentViewer } from '../auth/current-viewer.decorator.js';
import { GuestAccessService } from '../auth/guest-access.service.js';
import type { Viewer } from '../auth/viewer.types.js';
import { ApiValidationErrorResponse } from '../swagger/api-docs.decorators.js';
import { TableSessionsService } from '../table-sessions/table-sessions.service.js';

/** The part of the Fastify reply this controller touches, without depending on fastify directly. */
interface GuestReply {
  status(statusCode: number): unknown;
  header(name: string, value: string): unknown;
}

@ApiTags('Viewer')
@Controller('viewer')
export class ViewerController {
  constructor(
    private readonly guestAccess: GuestAccessService,
    private readonly tableSessionsService: TableSessionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Who am I',
    description:
      'Returns who the request is from: a signed-in member of staff with their role, or a guest with the table session they joined. ' +
      'Returns `null` for an anonymous caller, and for a guest once service has cleared their table: that is how the guest app learns the visit is over.',
  })
  @ApiOkResponse({ description: 'The caller, or null.', standardSchema: viewerSchema })
  whoAmI(@CurrentViewer() viewer: Viewer | undefined) {
    return viewer ?? null;
  }

  @Post('table')
  @ApiOperation({
    summary: 'Enter as a guest by selecting a table',
    description:
      'Demo entry without a QR code. Joins or opens the selected table visit and sets the signed HttpOnly guest cookie. Orders and live events remain scoped to that visit.',
  })
  @ApiOkResponse({ description: 'Joined an existing visit.', standardSchema: tableSessionSchema })
  @ApiCreatedResponse({ description: 'Opened a new visit.', standardSchema: tableSessionSchema })
  @ApiValidationErrorResponse('The table id is invalid or the table does not exist.')
  async selectTable(
    @Body({ schema: openTableSessionSchema }) dto: OpenTableSessionDto,
    @Res({ passthrough: true }) reply: GuestReply,
    @CurrentViewer() viewer: Viewer | undefined,
  ) {
    const { session, created } = await this.tableSessionsService.openOrJoin(dto.tableId);
    reply.header(
      'set-cookie',
      this.guestAccess.cookieFor(session.id, viewer?.kind === 'guest' ? viewer : undefined),
    );
    reply.status(created ? 201 : 200);
    return session;
  }

  @Post('guest')
  @ApiOperation({
    summary: 'Enter as a guest by QR code',
    description:
      "What the guest app calls with the `tableId` and `token` read from the table's QR code. Needs no login.\n\n" +
      'Joins the party seated at the table, or seats a new one if the table is free, exactly like `POST /table-sessions`: 200 when joining, 201 when opening. ' +
      'The response sets the `sr_guest` cookie, which lets the caller act as a guest of that session until service clears the table.\n\n' +
      'Scanning again is harmless and renews the cookie. Scanning after the table was cleared seats a new party and replaces the cookie.',
  })
  @ApiOkResponse({
    description: 'Joined the party already seated at the table. Sets the `sr_guest` cookie.',
    standardSchema: tableSessionSchema,
  })
  @ApiCreatedResponse({
    description: 'The table was free; a new party has been seated. Sets the `sr_guest` cookie.',
    standardSchema: tableSessionSchema,
  })
  @ApiValidationErrorResponse('The payload failed validation, or the table does not exist.')
  @ApiForbiddenResponse({ description: 'The token is not valid for that table.' })
  async enterAsGuest(
    @Body({ schema: enterAsGuestSchema }) dto: EnterAsGuestDto,
    @Res({ passthrough: true }) reply: GuestReply,
    @CurrentViewer() viewer: Viewer | undefined,
  ) {
    if (!this.guestAccess.verifyTableToken(dto.tableId, dto.token)) {
      throw new ForbiddenException(`This QR code is not valid for table ${dto.tableId}`);
    }

    const { session, created } = await this.tableSessionsService.openOrJoin(dto.tableId);

    reply.header(
      'set-cookie',
      this.guestAccess.cookieFor(session.id, viewer?.kind === 'guest' ? viewer : undefined),
    );
    reply.status(created ? 201 : 200);

    return session;
  }
}
