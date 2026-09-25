import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccessService } from './access.service.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Global()
@Module({
  providers: [AuthService, AccessService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService, AccessService],
})
export class AuthModule {}
