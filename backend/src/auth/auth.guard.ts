import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromNodeHeaders } from 'better-auth/node';

import { PrismaService } from '../database/prisma.service.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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
    const session = await this.authService.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      throw new UnauthorizedException('Login required');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { authUserId: session.user.id },
      select: { id: true, role: true },
    });

    if (!employee) {
      throw new UnauthorizedException('No active employee account');
    }

    request.employee = employee;
    return true;
  }
}
