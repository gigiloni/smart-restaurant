import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app/app.module.js';
import { configureApp } from '../../src/app/configure-app.js';

/**
 * The application exactly as `main.ts` builds it, on the test database.
 *
 * Requests normally go through `app.inject()`, which needs no socket. Pass
 * `listen: true` for the live stream: an SSE response never ends, so it has to
 * be read from a real connection (see `openSse`).
 */
export async function createTestApp(
  options: { listen?: boolean } = {},
): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  // Quiet by default; TEST_LOG=1 shows the application log, e.g. the cause of a 500.
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    logger: process.env.TEST_LOG ? undefined : false,
  });

  configureApp(app);

  if (options.listen) {
    await app.listen({ port: 0, host: '127.0.0.1' });
  } else {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }

  return app;
}
