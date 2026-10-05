import { Global, Module } from '@nestjs/common';
import { StockService } from './stock.service.js';

import { IngredientsController } from './ingredients.controller.js';
import { IngredientsRepository } from './ingredients.repository.js';
import { IngredientsService } from './ingredients.service.js';

@Global()
@Module({
  controllers: [IngredientsController],
  providers: [IngredientsService, IngredientsRepository, StockService],
  exports: [IngredientsService, StockService],
})
export class IngredientsModule {}
