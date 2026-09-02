import { z } from 'zod';

/**
 * Route parameters arrive as strings, so ids are coerced before validation.
 * All entities use auto-incrementing integer primary keys.
 */
export const idParamSchema = z.coerce.number().int().positive().meta({
  description: 'Auto-incrementing integer primary key. Coerced from the path string.',
  example: 1,
});

export type IdParam = z.infer<typeof idParamSchema>;
