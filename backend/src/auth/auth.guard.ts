import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import { ALLOW_ANONYMOUS, ALLOW_GUESTS } from './access-metadata.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { ViewerResolver } from './viewer-resolver.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    private readonly viewers: ViewerResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin) {
      const allowedOrigins = [
        this.config.getOrThrow<string>('auth.url'),
        this.config.get<string>('auth.frontendUrl'),
      ]
        .filter((origin): origin is string => Boolean(origin))
        .map((origin) => new URL(origin).origin);
      if (!allowedOrigins.includes(request.headers.origin)) {
        throw new ForbiddenException('Origin is not allowed');
      }
    }

    const targets = [context.getHandler(), context.getClass()];
    const allowAnonymous = this.reflector.getAllAndOverride<boolean>(ALLOW_ANONYMOUS, targets);
    const allowGuests = this.reflector.getAllAndOverride<boolean>(ALLOW_GUESTS, targets);

    const resolved = await this.viewers.resolve(request.headers, {
      allowGuests: Boolean(allowGuests || allowAnonymous),
    });

    if (resolved) {
      if (resolved.employee) {
        request.employee = resolved.employee;
      }
      request.viewer = resolved.viewer;
      return true;
    }

    if (allowAnonymous) {
      return true;
    }

    throw new UnauthorizedException(
      allowGuests ? 'Login or scan the QR code on your table' : 'Login required',
    );
  }
}
