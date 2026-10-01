import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';

import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class AuthService {
  readonly auth: ReturnType<typeof betterAuth>;

  constructor(prisma: PrismaService, config: ConfigService) {
    const frontendUrl = config.get<string>('auth.frontendUrl');
    this.auth = betterAuth({
      database: prismaAdapter(prisma, { provider: 'postgresql' }),
      baseURL: config.getOrThrow<string>('auth.url'),
      basePath: '/api/auth',
      secret: config.getOrThrow<string>('auth.secret'),
      trustedOrigins: [
        config.getOrThrow<string>('auth.url'),
        ...(frontendUrl ? [frontendUrl] : []),
      ],
      emailAndPassword: {
        enabled: true,
        autoSignIn: false,
        minPasswordLength: 12,
        maxPasswordLength: 128,
      },
    }) as ReturnType<typeof betterAuth>;
  }
}
