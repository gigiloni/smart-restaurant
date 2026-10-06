import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { testDatabaseName, testEnv } from './support/env.js';

/** Any constant: held for the whole run, so two runs never share the database at once. */
const RUN_LOCK = 4_242_001;

/**
 * Once per run: create the test database if it is missing, bring it to the
 * latest migration, and take a lock on it until the run ends. Every test file
 * empties the database, so a second run (another terminal, an IDE, CI on the
 * same server) waits for this one instead of wiping its data mid-test.
 */
export default async function setup(): Promise<() => Promise<void>> {
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

  // Advisory locks belong to a database, so take it in the test database itself.
  const lock = new pg.Client({ connectionString: testEnv.DATABASE_URL });
  await lock.connect();
  const { rows } = await lock.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [RUN_LOCK]);

  if (!rows[0].locked) {
    console.log(`Another test run is using ${name}; waiting for it to finish...`);
    await lock.query('SELECT pg_advisory_lock($1)', [RUN_LOCK]);
  }

  execSync('pnpm exec prisma migrate deploy', {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, ...testEnv },
    stdio: 'inherit',
  });

  // Ending the connection releases the lock.
  return async () => {
    await lock.end();
  };
}
