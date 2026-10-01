import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccessService } from './access.service.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { GuestAccessService } from './guest-access.service.js';
import { ViewerResolver } from './viewer-resolver.service.js';

@Global()
@Module({
  providers: [
    AuthService,
    AccessService,
    GuestAccessService,
    ViewerResolver,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, AccessService, GuestAccessService, ViewerResolver],
})
export class AuthModule {}
