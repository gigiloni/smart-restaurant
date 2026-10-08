import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

/** Used when neither TEST_DATABASE_URL nor a DATABASE_URL is set: the compose.yml defaults. */
const FALLBACK_DATABASE_URL = 'postgresql://admin:admin@localhost:5432/smart_restaurant';

/** `.env` files the backend may run with: the repository root's (`pnpm start:backend`) and backend's (Prisma commands). */
const ENV_FILES = ['../../../.env', '../../.env'].map((path) => fileURLToPath(new URL(path, import.meta.url)));

/**
 * The development DATABASE_URL: one set in the shell wins; otherwise the one in
 * the `.env` files, which must agree. Nx loads those files into the
 * environment of every task, so a value equal to one of them counts as coming
 * from the files, and `pnpm test` decides the same way as running Vitest directly.
 */
function developmentDatabaseUrl(): string | undefined {
  const inFiles = ENV_FILES.flatMap((path) => {
    const url = config({ path, processEnv: {}, quiet: true }).parsed?.DATABASE_URL;

    return url ? [{ path, url }] : [];
  });
  const fromEnvironment = process.env.DATABASE_URL;

  if (fromEnvironment && !inFiles.some(({ url }) => url === fromEnvironment)) {
    return fromEnvironment;
  }

  if (new Set(inFiles.map(({ url }) => url)).size > 1) {
    throw new Error(
      `DATABASE_URL differs between ${inFiles.map(({ path }) => path).join(' and ')}. ` +
        'Make the two agree, or set TEST_DATABASE_URL to the test database to use.',
    );
  }

  return inFiles[0]?.url;
}

/**
 * The database integration tests run against: `TEST_DATABASE_URL` if set,
 * otherwise the development database's server, user and password with `_test`
 * appended to the database name. The tests reach the same PostgreSQL as
 * `pnpm db:migrate` does, but never the development database itself.
 */
function resolveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }

  const url = new URL(developmentDatabaseUrl() ?? FALLBACK_DATABASE_URL);
  const name = decodeURIComponent(url.pathname.slice(1)) || 'smart_restaurant';
  url.pathname = `/${name.endsWith('_test') ? name : `${name}_test`}`;

  return url.toString();
}

/**
 * The environment every integration test runs with. Fixed values apart from
 * the database, so the tests run the same on every machine.
 */
export const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: resolveTestDatabaseUrl(),
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'integration-tests-only-not-a-real-secret',
  FRONTEND_URL: 'http://localhost:4200',
} as const;

export function testDatabaseName(): string {
  const name = decodeURIComponent(new URL(testEnv.DATABASE_URL).pathname.slice(1));

  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to run integration tests against "${name}": the tests wipe their database, so its name must end in "_test".`,
    );
  }

  return name;
}

/** Where the tests connect, for error messages: server, port, user and database, never the password. */
export function describeTestDatabase(): string {
  const url = new URL(testEnv.DATABASE_URL);

  return `database "${testDatabaseName()}" on ${url.hostname}:${url.port || 5432} as "${decodeURIComponent(url.username)}"`;
}
