import { Module } from '@nestjs/common';

import { TableSessionsController } from './table-sessions.controller.js';
import { TableSessionsRepository } from './table-sessions.repository.js';
import { TableSessionsService } from './table-sessions.service.js';

@Module({
  controllers: [TableSessionsController],
  providers: [TableSessionsService, TableSessionsRepository],
  exports: [TableSessionsService],
})
export class TableSessionsModule {}
