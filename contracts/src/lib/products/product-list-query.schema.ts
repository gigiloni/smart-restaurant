import { z } from 'zod';

import { idParamSchema } from '../common/id.schema.js';

/** Ceiling on `ids`, so one request cannot turn into an unbounded `IN` list. */
export const MAX_PRODUCT_IDS = 100;

/** Asking for a product twice returns it once. */
export const distinctIds = (ids: number[]): number[] => [...new Set(ids)];

/**
 * Accepts `?ids=1,2,3` and the repeated form `?ids=1&ids=2`, which is what
 * Angular's `HttpParams.append` produces, or any mix of the two.
 */
const splitIds = (value: unknown): unknown =>
  value === undefined ? undefined : [value].flat().flatMap((part) => String(part).split(','));

export const productListQuerySchema = z.object({
  ids: z
    .preprocess(splitIds, z.array(idParamSchema).min(1).max(MAX_PRODUCT_IDS).transform(distinctIds))
    .optional()
    .meta({
      description:
        `Return only these products, e.g. \`?ids=3,1,7\` or \`?ids=3&ids=1\`. At most ${MAX_PRODUCT_IDS} ids; duplicates are ignored. ` +
        'Ids that match no product are left out of the result rather than failing the request, so compare the result with what you asked for. Omit the parameter to get every product.',
      override: {
        type: 'array',
        items: { type: 'integer', minimum: 1 },
        minItems: 1,
        maxItems: MAX_PRODUCT_IDS,
      },
    }),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
