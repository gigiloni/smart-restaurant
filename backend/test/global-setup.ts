import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { describeTestDatabase, testDatabaseName, testEnv } from './support/env.js';

/** Any constant: held for the whole run, so two runs never share the database at once. */
const RUN_LOCK = 4_242_001;

/** PostgreSQL's error code for "database does not exist". */
const INVALID_CATALOG_NAME = '3D000';

/**
 * Once per run: create the test database if it is missing, bring it to the
 * latest migration, and take a lock on it until the run ends. Every test file
 * empties the database, so a second run (another terminal, an IDE, CI on the
 * same server) waits for this one instead of wiping its data mid-test.
 */
export default async function setup(): Promise<() => Promise<void>> {
  // Advisory locks belong to a database, so the lock is taken in the test database itself.
  const lock = await connectCreatingIfMissing();
  const { rows } = await lock.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [
    RUN_LOCK,
  ]);

  if (!rows[0].locked) {
    console.log(`Another test run is using ${describeTestDatabase()}; waiting for it to finish...`);
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

/** A connection to the test database, created first if the server does not have it yet. */
async function connectCreatingIfMissing(): Promise<pg.Client> {
  try {
    return await connect(testEnv.DATABASE_URL);
  } catch (error) {
    if ((error as { code?: string }).code !== INVALID_CATALOG_NAME) {
      throw unreachable(error);
    }
  }

  const server = new URL(testEnv.DATABASE_URL);
  server.pathname = '/postgres';

  try {
    const admin = await connect(server.toString());

    try {
      await admin.query(`CREATE DATABASE "${testDatabaseName()}"`);
    } finally {
      await admin.end();
    }
  } catch (error) {
    throw new Error(
      `Could not create the ${describeTestDatabase()}: ${(error as Error).message}. ` +
        'Create it by hand, or point TEST_DATABASE_URL at a database whose name ends in "_test".',
    );
  }

  return connect(testEnv.DATABASE_URL);
}

async function connect(connectionString: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString });

  try {
    await client.connect();
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }

  return client;
}

function unreachable(error: unknown): Error {
  return new Error(
    `Integration tests could not connect to the ${describeTestDatabase()}: ${(error as Error).message}. ` +
      'They use the server, user and password of DATABASE_URL (from the environment, .env or backend/.env); ' +
      'set TEST_DATABASE_URL to use another.',
  );
}
