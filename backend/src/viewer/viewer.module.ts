import { Module } from '@nestjs/common';

import { TableSessionsModule } from '../table-sessions/table-sessions.module.js';
import { ViewerController } from './viewer.controller.js';

@Module({
  imports: [TableSessionsModule],
  controllers: [ViewerController],
})
export class ViewerModule {}
