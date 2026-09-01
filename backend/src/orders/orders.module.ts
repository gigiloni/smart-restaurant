import { Module } from '@nestjs/common';

import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { OrdersRepository } from './orders.repository.js';

@Module({
  controllers: [
    OrdersController,
  ],

  providers: [
    OrdersService,
    OrdersRepository,
  ],
})
export class OrdersModule {}
