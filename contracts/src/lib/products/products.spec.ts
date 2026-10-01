import { describe, expect, it } from 'vitest';

import { createProductSchema } from './create-product.schema.js';
import { productIngredientsSchema } from './product-ingredient.schema.js';
import { productListQuerySchema } from './product-list-query.schema.js';
import { productsByIdSchema } from './products-by-id.schema.js';
import { updateProductSchema } from './update-product.schema.js';

const ids = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1)).join(',');

describe('U-CT-05 product ids in the query string', () => {
  it('reads a comma-separated list', () => {
    expect(productListQuerySchema.parse({ ids: '3,1,7' }).ids).toEqual([3, 1, 7]);
  });

  it('reads repeated parameters', () => {
    expect(productListQuerySchema.parse({ ids: ['3', '1'] }).ids).toEqual([3, 1]);
  });

  it('reads a mix of both and drops duplicates', () => {
    expect(productListQuerySchema.parse({ ids: ['3,1', '3'] }).ids).toEqual([3, 1]);
  });

  it('leaves ids out when the parameter is absent', () => {
    expect(productListQuerySchema.parse({}).ids).toBeUndefined();
  });

  it('accepts 100 ids and rejects 101', () => {
    expect(productListQuerySchema.safeParse({ ids: ids(100) }).success).toBe(true);
    expect(productListQuerySchema.safeParse({ ids: ids(101) }).success).toBe(false);
  });

  it.each(['', 'abc', '1,,2', '0'])('rejects %j', (value) => {
    expect(productListQuerySchema.safeParse({ ids: value }).success).toBe(false);
  });
});

describe('U-CT-05 product ids in a JSON body', () => {
  it('drops duplicates', () => {
    expect(productsByIdSchema.parse({ ids: [3, 3, 1] }).ids).toEqual([3, 1]);
  });

  it('counts the limit before dropping duplicates', () => {
    expect(productsByIdSchema.safeParse({ ids: Array(101).fill(1) }).success).toBe(false);
  });

  it.each([{ ids: [] }, { ids: ['1'] }, { ids: [1.5] }, {}])('rejects %j', (body) => {
    expect(productsByIdSchema.safeParse(body).success).toBe(false);
  });
});

describe('U-CT-07 product payloads', () => {
  const valid = { name: 'Pizza', price: 1, type: 'FOOD' };

  it('trims the name', () => {
    expect(createProductSchema.parse({ ...valid, name: '  Pizza ' }).name).toBe('Pizza');
  });

  it('accepts a free product and a null description', () => {
    expect(createProductSchema.safeParse({ ...valid, price: 0, description: null }).success).toBe(true);
  });

  it.each([
    ['a blank name', { name: '   ' }],
    ['a name over 100 characters', { name: 'x'.repeat(101) }],
    ['a negative price', { price: -0.01 }],
    ['an unknown type', { type: 'DESSERT' }],
    ['a description over 100 characters', { description: 'x'.repeat(101) }],
  ])('rejects %s', (_, change) => {
    expect(createProductSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });

  it('rejects an ingredient listed twice', () => {
    const recipe = [{ ingredientId: 1 }, { ingredientId: 1, amount: 2 }];

    expect(productIngredientsSchema.safeParse(recipe).success).toBe(false);
  });

  it('defaults a recipe amount to 0', () => {
    expect(productIngredientsSchema.parse([{ ingredientId: 1 }])).toEqual([{ ingredientId: 1, amount: 0 }]);
  });

  it('rejects an empty update but accepts clearing the recipe', () => {
    expect(updateProductSchema.safeParse({}).success).toBe(false);
    expect(updateProductSchema.safeParse({ ingredients: [] }).success).toBe(true);
  });
});
