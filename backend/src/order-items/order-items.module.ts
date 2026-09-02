import { Module } from '@nestjs/common';

import { OrdersModule } from '../orders/orders.module.js';
import { OrderItemsController } from './order-items.controller.js';
import { OrderItemsRepository } from './order-items.repository.js';
import { OrderItemsService } from './order-items.service.js';

@Module({
  imports: [OrdersModule],
  controllers: [OrderItemsController],
  providers: [OrderItemsService, OrderItemsRepository],
})
export class OrderItemsModule {}
