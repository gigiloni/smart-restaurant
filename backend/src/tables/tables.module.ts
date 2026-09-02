import { Module } from '@nestjs/common';

import { TablesController } from './tables.controller.js';
import { TablesService } from './tables.service.js';
import { TablesRepository } from './tables.repository.js';

@Module({
  controllers: [
    TablesController,
  ],

  providers: [
    TablesService,
    TablesRepository,
  ],
})
export class TablesModule {}
