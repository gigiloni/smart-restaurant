import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromNodeHeaders } from 'better-auth/node';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { AuthService } from '../auth/auth.service.js';
import { enableCors } from '../cors.js';
import { setupSwagger } from '../swagger/swagger.js';

/** The Better Auth routes exposed under `/api/auth`; everything else there is 404. */
const AUTH_ROUTES = new Set([
  'POST /api/auth/sign-in/email',
  'POST /api/auth/sign-out',
  'POST /api/auth/change-password',
  'GET /api/auth/get-session',
]);

/**
 * Everything the API needs besides its modules: the `/api` prefix, CORS,
 * validation, Swagger and the Better Auth routes. Shared by `main.ts` and the
 * integration tests, so the tests run the same application that is deployed.
 */
export function configureApp(app: NestFastifyApplication): void {
  const configService = app.get(ConfigService);
  const authService = app.get(AuthService);

  app.setGlobalPrefix('api');

  // Before any route is registered, so the hook covers all of them.
  const frontendUrl = configService.get<string>('auth.frontendUrl');
  if (frontendUrl) {
    enableCors(app, [frontendUrl]);
  }

  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      transform: true,
    }),
  );

  setupSwagger(app);

  app
    .getHttpAdapter()
    .getInstance()
    .route({
      method: ['GET', 'POST'],
      url: '/api/auth/*',
      async handler(request, reply) {
        const path = new URL(request.url, configService.getOrThrow<string>('auth.url')).pathname;
        if (!AUTH_ROUTES.has(`${request.method} ${path}`)) {
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
}
