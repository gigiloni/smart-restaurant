import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { testDatabaseName, testEnv } from './support/env.js';

/**
 * Once per run: create the test database if it is missing and bring it to the
 * latest migration, so a broken migration fails the run before any test.
 */
export default async function setup(): Promise<void> {
  const name = testDatabaseName();
  const server = new URL(testEnv.DATABASE_URL);
  server.pathname = '/postgres';

  const admin = new pg.Client({ connectionString: server.toString() });
  await admin.connect();

  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);

    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await admin.end();
  }

  execSync('pnpm exec prisma migrate deploy', {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, ...testEnv },
    stdio: 'inherit',
  });
}
