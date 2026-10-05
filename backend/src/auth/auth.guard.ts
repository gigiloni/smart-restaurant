import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import { REQUIRE_LOGIN, type LoginRequirement } from './access-metadata.js';
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

    // Who is asking, if anyone: a staff login or a guest cookie. Handlers read
    // it with @CurrentEmployee() / @CurrentViewer(); both are undefined for an
    // anonymous caller.
    const resolved = await this.viewers.resolve(request.headers, { allowGuests: true });

    if (resolved) {
      if (resolved.employee) {
        request.employee = resolved.employee;
      }
      request.viewer = resolved.viewer;
    }

    const requirement = this.reflector.getAllAndOverride<LoginRequirement | undefined>(
      REQUIRE_LOGIN,
      [context.getHandler(), context.getClass()],
    );

    // Public unless the route says otherwise (see RequireLogin).
    if (!requirement) {
      return true;
    }

    if (resolved && (resolved.viewer.kind === 'staff' || requirement.guests)) {
      if (
        resolved.viewer.kind === 'staff' &&
        requirement.roles &&
        !requirement.roles.includes(resolved.viewer.role)
      ) {
        throw new ForbiddenException('This role cannot access this operation');
      }
      return true;
    }

    throw new UnauthorizedException(
      requirement.guests ? 'Login or scan the QR code on your table' : 'Login required',
    );
  }
}
