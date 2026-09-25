import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app/app.module.js';
import { AuthService } from './auth/auth.service.js';
import { setupSwagger } from './swagger/swagger.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  const configService = app.get(ConfigService);
  const authService = app.get(AuthService);

  const port = configService.get<number>('app.port') ?? 3000;

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      transform: true,
    }),
  );

  setupSwagger(app);

  const authRoutes = new Map([
    ['POST /api/auth/sign-in/email', true],
    ['POST /api/auth/sign-out', true],
    ['POST /api/auth/change-password', true],
    ['GET /api/auth/get-session', true],
  ]);

  app
    .getHttpAdapter()
    .getInstance()
    .route({
      method: ['GET', 'POST'],
      url: '/api/auth/*',
      async handler(request, reply) {
        const path = new URL(request.url, configService.getOrThrow<string>('auth.url')).pathname;
        if (!authRoutes.has(`${request.method} ${path}`)) {
          return reply.status(404).send({ message: 'Authentication route not found' });
        }

        const headers = fromNodeHeaders(request.headers);
        const response = await authService.auth.handler(
          new Request(new URL(request.url, configService.getOrThrow<string>('auth.url')), {
            method: request.method,
            headers,
            ...(request.method === 'POST' ? { body: JSON.stringify(request.body ?? {}) } : {}),
          }),
        );

        reply.status(response.status);
        response.headers.forEach((value, key) => {
          if (key !== 'set-cookie') reply.header(key, value);
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length) reply.header('set-cookie', cookies);
        return reply.send(response.body ? await response.text() : null);
      },
    });

  await app.listen({
    port,
    host: '0.0.0.0',
  });
}

await bootstrap();
