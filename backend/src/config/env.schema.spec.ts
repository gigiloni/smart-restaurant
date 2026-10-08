import { describe, expect, it } from 'vitest';

import { envSchema } from './env.schema.js';

const valid = {
  DATABASE_URL: 'postgresql://admin:admin@localhost:5432/smart_restaurant',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
};

// ConfigModule validates the environment against this schema at startup, so a
// rejected value stops the backend from booting.
describe('U-ENV environment schema', () => {
  it('01 fills in the defaults', () => {
    expect(envSchema.parse(valid)).toMatchObject({ NODE_ENV: 'development', PORT: 3000 });
  });

  it('02 treats FRONTEND_URL as optional', () => {
    expect(envSchema.safeParse(valid).success).toBe(true);
    expect(envSchema.safeParse({ ...valid, FRONTEND_URL: 'http://localhost:4200' }).success).toBe(true);
  });

  it.each([
    ['a secret under 32 characters', { BETTER_AUTH_SECRET: 'x'.repeat(31) }],
    ['a missing database URL', { DATABASE_URL: undefined }],
    ['an auth URL that is not a URL', { BETTER_AUTH_URL: 'localhost' }],
    ['a frontend URL that is not a URL', { FRONTEND_URL: 'not a url' }],
    ['an unknown NODE_ENV', { NODE_ENV: 'staging' }],
    ['a port that is not a positive integer', { PORT: '0' }],
  ])('03 rejects %s', (_, change) => {
    expect(envSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});
