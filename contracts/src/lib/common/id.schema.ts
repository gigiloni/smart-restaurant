import { z } from 'zod';

/**
 * Route parameters arrive as strings, so ids are coerced before validation.
 * All entities use auto-incrementing integer primary keys.
 */
export const idParamSchema = z.coerce.number().int().positive();

export type IdParam = z.infer<typeof idParamSchema>;
