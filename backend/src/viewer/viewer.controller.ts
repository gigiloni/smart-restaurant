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
  tableSessionSchema,
  viewerSchema,
  type EnterAsGuestDto,
} from '@smart-restaurant/contracts';

import { AllowAnonymous, AllowGuests } from '../auth/access-metadata.js';
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
  @AllowGuests()
  @ApiOperation({
    summary: 'Who am I',
    description:
      'Returns who the request is from: a signed-in member of staff with their role, or a guest with the table session they joined. ' +
      'Guests get 401 here once service has cleared their table, which is how the guest app learns the visit is over.',
  })
  @ApiOkResponse({ description: 'The caller.', standardSchema: viewerSchema })
  whoAmI(@CurrentViewer() viewer: Viewer) {
    return viewer;
  }

  @Post('guest')
  @AllowAnonymous()
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
  ) {
    if (!this.guestAccess.verifyTableToken(dto.tableId, dto.token)) {
      throw new ForbiddenException(`This QR code is not valid for table ${dto.tableId}`);
    }

    const { session, created } = await this.tableSessionsService.openOrJoin(dto.tableId);

    reply.header('set-cookie', this.guestAccess.cookieFor(session.id));
    reply.status(created ? 201 : 200);

    return session;
  }
}
