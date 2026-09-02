import { Module } from '@nestjs/common';

import { IngredientsController } from './ingredients.controller.js';
import { IngredientsRepository } from './ingredients.repository.js';
import { IngredientsService } from './ingredients.service.js';

@Module({
  controllers: [IngredientsController],
  providers: [IngredientsService, IngredientsRepository],
  exports: [IngredientsService],
})
export class IngredientsModule {}
