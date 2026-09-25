import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
  Req,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Observable } from 'rxjs';

import {
  liveEventsQuerySchema,
  liveSnapshotSchema,
  type LiveEventsQuery,
} from '@smart-restaurant/contracts';

import { AllowGuests } from '../auth/access-metadata.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentViewer } from '../auth/current-viewer.decorator.js';
import { ViewerResolver } from '../auth/viewer-resolver.service.js';
import type { Viewer } from '../auth/viewer.types.js';
import { ApiValidationErrorResponse } from '../swagger/api-docs.decorators.js';
import { liveStream, HEARTBEAT_MS } from './live-stream.js';
import { LiveService } from './live.service.js';
import { OrderEventFeed } from './order-event-feed.service.js';
import { LOG_RETENTION_HOURS, OrderEventLog } from './order-event-log.js';

const EVENT_ID = /^\d{1,15}$/;

@ApiTags('Live')
@Controller('live')
export class LiveController {
  constructor(
    private readonly liveService: LiveService,
    private readonly feed: OrderEventFeed,
    private readonly log: OrderEventLog,
    private readonly viewers: ViewerResolver,
  ) {}

  @Get('snapshot')
  @AllowGuests()
  @ApiOperation({
    summary: 'Load the live state',
    description:
      'Returns the table sessions and orders the caller may see, read in one consistent snapshot, and the `cursor` of the last change it reflects. ' +
      'Load this first, then open `GET /live/events?since=<cursor>`.\n\n' +
      '- **SERVICE, ADMIN**: every open session and all of its orders, paid ones included.\n' +
      '- **KITCHEN**: open orders holding at least one APPETIZER or FOOD item, with only those items, and their sessions.\n' +
      '- **BAR**: the same for DRINK items.\n' +
      '- **Guests**: their own session and all of its orders. `employeeId` and `employee` are always null.',
  })
  @ApiOkResponse({
    description: 'The live state and its cursor.',
    standardSchema: liveSnapshotSchema,
  })
  snapshot(@CurrentViewer() viewer: Viewer) {
    return this.liveService.snapshot(viewer);
  }

  @Sse('events')
  @AllowGuests()
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: 'Stream live changes (SSE)',
    description:
      'A Server-Sent Events stream of every change after `since` that the caller may see, oldest first, then new changes as they are committed. ' +
      'Open it with `new EventSource(url, { withCredentials: true })`: the login or guest cookie authenticates it.\n\n' +
      '**Messages.** Each change is an event named after its `type` (`order.created`, `item.status_changed`, …) whose `data` is an `OrderEvent`. ' +
      'Apply them in order. `data` is the whole entity after the change, so applying one is a replace, and applying one twice is harmless. ' +
      "`ready` (data `LiveReady`) says the backlog has been sent. `resync` (data `LiveResync`) says the client's state cannot be continued: close the EventSource, reload the snapshot and reconnect with its cursor. " +
      `A comment line is sent every ${HEARTBEAT_MS / 1000} seconds so idle connections stay open.\n\n` +
      '**No lost updates.** Every message carries the event id as its SSE `id`, so when the connection drops the browser reconnects with `Last-Event-ID` and the stream resumes exactly after the last message received. ' +
      `Changes are kept for ${LOG_RETENTION_HOURS} hours; a client away for longer gets \`resync\`.\n\n` +
      '**Scope** is the same as `GET /live/snapshot`. KITCHEN and BAR get item events for their product types, and order and move events for orders holding such items with the other items removed; they get no `session.opened` or `session.closed`. ' +
      'Guests get the events of their own session without employees, and the stream ends after their `session.closed`.\n\n' +
      '**Moves.** When a party moves, only `session.moved` is sent; update the `tableId` and `table` of every order in that session from it.',
  })
  @ApiHeader({
    name: 'Last-Event-ID',
    required: false,
    description:
      'Sent by the browser when it reconnects: the `id` of the last message received. Takes precedence over `since`.',
  })
  @ApiOkResponse({
    description:
      'A `text/event-stream`. It runs until the client closes it, except after `resync`, and for a guest after `session.closed`.',
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  @ApiValidationErrorResponse('Neither `since` nor `Last-Event-ID` was given, or one is malformed.')
  events(
    @Query({ schema: liveEventsQuerySchema }) query: LiveEventsQuery,
    @Headers('last-event-id') lastEventId: string | undefined,
    @CurrentViewer() viewer: Viewer,
    @Req() request: AuthenticatedRequest,
  ): Observable<MessageEvent> {
    const since = this.startingPoint(query.since, lastEventId);

    return liveStream({
      viewer,
      since,
      feed: this.feed,
      log: this.log,
      revalidate: async () =>
        (await this.viewers.resolve(request.headers, { allowGuests: true }))?.viewer ?? null,
    });
  }

  /** A browser reconnecting sends `Last-Event-ID`, which is newer than the `since` in its URL. */
  private startingPoint(since: number | undefined, lastEventId: string | undefined): number {
    if (lastEventId !== undefined && lastEventId !== '') {
      if (!EVENT_ID.test(lastEventId)) {
        throw new BadRequestException('Last-Event-ID: must be a non-negative integer');
      }

      return Number(lastEventId);
    }

    if (since === undefined) {
      throw new BadRequestException('since: required; pass the cursor from GET /live/snapshot');
    }

    return since;
  }
}
