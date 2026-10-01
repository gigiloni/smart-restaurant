import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';
import { RowLocks } from './row-locks.js';

@Global()
@Module({
  providers: [PrismaService, RowLocks],
  exports: [PrismaService, RowLocks],
})
export class DatabaseModule {}
