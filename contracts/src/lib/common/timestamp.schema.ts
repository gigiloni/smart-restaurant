import { z } from 'zod';

/**
 * A point in time as it appears in JSON: an ISO 8601 string in UTC, which is
 * what a `Date` serialises to.
 */
export const timestampSchema = z.iso.datetime();
