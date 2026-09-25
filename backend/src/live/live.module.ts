import { Module } from '@nestjs/common';

import { LiveController } from './live.controller.js';
import { LiveService } from './live.service.js';
import { OrderEventFeed } from './order-event-feed.service.js';
import { OrderEventLog } from './order-event-log.js';

@Module({
  controllers: [LiveController],
  providers: [LiveService, OrderEventFeed, OrderEventLog],
})
export class LiveModule {}
