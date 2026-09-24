import { z } from 'zod';

import { INT32_MAX } from './integer.schema.js';

/**
 * Route parameters arrive as strings, so ids are coerced before validation.
 * All entities use auto-incrementing integer primary keys.
 */
export const idParamSchema = z.coerce.number().int().positive().max(INT32_MAX).meta({
  description:
    'Auto-incrementing integer primary key, coerced from the path string. Bounded by the `int4` column, so a larger number is rejected as a bad request rather than reaching the database.',
  example: 1,
});

export type IdParam = z.infer<typeof idParamSchema>;
