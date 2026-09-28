import { Module } from '@nestjs/common';

import { TableSessionsModule } from '../table-sessions/table-sessions.module.js';
import { OrderLock } from './order-lock.js';
import { OrdersController } from './orders.controller.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [TableSessionsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrderLock],
  exports: [OrdersService, OrderLock],
})
export class OrdersModule {}
