import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';

import { PrismaService } from '../database/prisma.service.js';
import { ALLOW_ANONYMOUS, ALLOW_GUESTS } from './access-metadata.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedEmployee, AuthenticatedRequest } from './auth.types.js';
import { GuestAccessService } from './guest-access.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    private readonly guestAccess: GuestAccessService,
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

    const employee = await this.findEmployee(request);

    if (employee) {
      request.employee = employee;
      request.viewer = { kind: 'staff', employeeId: employee.id, role: employee.role };
      return true;
    }

    if (allowGuests || allowAnonymous) {
      const guest = await this.guestAccess.resolve(request.headers.cookie);

      if (guest) {
        request.viewer = guest;
        return true;
      }
    }

    if (allowAnonymous) {
      return true;
    }

    throw new UnauthorizedException(
      allowGuests ? 'Login or scan the QR code on your table' : 'Login required',
    );
  }

  /** The employee behind the request's Better Auth session, if there is one. */
  private async findEmployee(request: AuthenticatedRequest): Promise<AuthenticatedEmployee | null> {
    const session = await this.authService.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      return null;
    }

    return this.prisma.employee.findUnique({
      where: { authUserId: session.user.id },
      select: { id: true, role: true },
    });
  }
}
