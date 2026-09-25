import { Global, Module } from '@nestjs/common';

import { OrderEventsWriter } from './order-events.writer.js';

/**
 * Global so every module that writes orders, items or table sessions can append
 * events without importing this one.
 */
@Global()
@Module({
  providers: [OrderEventsWriter],
  exports: [OrderEventsWriter],
})
export class OrderEventsModule {}
