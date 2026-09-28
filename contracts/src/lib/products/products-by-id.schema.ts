import { z } from 'zod';

import { positiveInt32Schema } from '../common/integer.schema.js';
import { distinctIds, MAX_PRODUCT_IDS } from './product-list-query.schema.js';

/**
 * Body of `POST /products-by-id`: the same lookup as `GET /products?ids=`,
 * for clients that would rather send the ids as JSON. The ids arrive as JSON
 * numbers, so unlike the query string nothing is coerced.
 */
export const productsByIdSchema = z
  .object({
    ids: z
      .array(positiveInt32Schema)
      .min(1)
      .max(MAX_PRODUCT_IDS)
      .transform(distinctIds)
      .meta({
        description: `Ids of the products to return, at most ${MAX_PRODUCT_IDS}. Duplicates are ignored.`,
        example: [3, 1, 7],
      }),
  })
  .meta({
    id: 'ProductsById',
    title: 'Products by id',
    description: 'The products to look up.',
  });

export type ProductsByIdDto = z.infer<typeof productsByIdSchema>;
