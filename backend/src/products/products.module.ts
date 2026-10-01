import { Module } from '@nestjs/common';

import { ProductsByIdController } from './products-by-id.controller.js';
import { ProductsController } from './products.controller.js';
import { ProductsRepository } from './products.repository.js';
import { ProductsService } from './products.service.js';

@Module({
  controllers: [ProductsController, ProductsByIdController],
  providers: [ProductsService, ProductsRepository],
  exports: [ProductsService],
})
export class ProductsModule {}
