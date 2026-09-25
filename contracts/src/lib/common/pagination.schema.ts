import { z } from 'zod';

/** Rows returned when a request does not ask for a page size. */
export const DEFAULT_PAGE_SIZE = 50;

/** Ceiling on a single page, so one request cannot ask for the whole table. */
export const MAX_PAGE_SIZE = 200;

/**
 * Offset pagination for collection endpoints. Both parameters are optional, so
 * a client that ignores paging still gets a sensible first page.
 *
 * Query values arrive as strings and are coerced. `default` is applied before
 * coercion, so an absent parameter takes the default rather than failing on
 * `Number(undefined)`.
 */
export const paginationQuerySchema = z.object({
  take: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .meta({
      description: `How many rows to return. Defaults to ${DEFAULT_PAGE_SIZE}, capped at ${MAX_PAGE_SIZE}.`,
      example: 50,
    }),

  skip: z.coerce.number().int().nonnegative().default(0).meta({
    description: 'How many rows to skip before the page starts. Defaults to 0.',
    example: 0,
  }),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
