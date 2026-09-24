import { z } from 'zod';

/**
 * Upper bound of a Postgres `integer`. Every id, count and amount column in the
 * schema is `int4`, so a value above this cannot be stored: without the bound
 * the database rejects it and the request fails as a 500 rather than a 400.
 */
export const INT32_MAX = 2_147_483_647;

/** An `int4` that must be at least 1: ids, and counts that cannot be zero. */
export const positiveInt32Schema = z.number().int().positive().max(INT32_MAX);

/** An `int4` that may be zero: counts and amounts. */
export const nonNegativeInt32Schema = z.number().int().nonnegative().max(INT32_MAX);
