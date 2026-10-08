import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll } from 'vitest';

import { createTestApp } from './app.js';
import { resetDatabase } from './database.js';
import { Fixtures } from './fixtures.js';
import { api, type Api } from './http.js';

export interface TestContext {
  app: NestFastifyApplication;
  /** An anonymous caller; access control is switched off, so it may call every route. */
  http: Api;
  fixtures: Fixtures;
}

/**
 * One application per test file, on an emptied database. Cases in a file run
 * in order and share it, so each case builds the data it needs.
 */
export function useTestApp(options: { listen?: boolean } = {}): TestContext {
  const context = {} as TestContext;

  beforeAll(async () => {
    await resetDatabase();
    context.app = await createTestApp(options);
    context.http = api(context.app);
    context.fixtures = new Fixtures(context.app);
  });

  afterAll(async () => {
    await context.app?.close();
  });

  return context;
}
