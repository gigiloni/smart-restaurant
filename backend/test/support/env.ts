/**
 * The environment every integration test runs with. Fixed values rather than
 * `backend/.env`, so a test can never reach the development database and runs
 * the same on every machine.
 *
 * Point the tests at another server with `TEST_DATABASE_URL`. The database name
 * must end in `_test`: each test file wipes it.
 */
export const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    'postgresql://admin:admin@localhost:5432/smart_restaurant_test',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'integration-tests-only-not-a-real-secret',
  FRONTEND_URL: 'http://localhost:4200',
} as const;

export function testDatabaseName(): string {
  const name = new URL(testEnv.DATABASE_URL).pathname.slice(1);

  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to run integration tests against "${name}": the tests wipe their database, so its name must end in "_test".`,
    );
  }

  return name;
}
