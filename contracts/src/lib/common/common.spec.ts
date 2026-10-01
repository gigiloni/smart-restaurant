import { describe, expect, it } from 'vitest';

import { idParamSchema } from './id.schema.js';
import { paginationQuerySchema } from './pagination.schema.js';

describe('U-CT-03 idParamSchema', () => {
  it('coerces a path string to a number', () => {
    expect(idParamSchema.parse('1')).toBe(1);
  });

  it('accepts the largest int4', () => {
    expect(idParamSchema.parse('2147483647')).toBe(2_147_483_647);
  });

  it.each(['0', '-1', '1.5', 'abc', '', '2147483648'])('rejects %j', (value) => {
    expect(idParamSchema.safeParse(value).success).toBe(false);
  });
});

describe('U-CT-04 paginationQuerySchema', () => {
  it('defaults to the newest 50', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ take: 50, skip: 0 });
  });

  it('accepts the 200 cap', () => {
    expect(paginationQuerySchema.parse({ take: '200' }).take).toBe(200);
  });

  it.each([{ take: '201' }, { take: '0' }, { skip: '-1' }, { take: 'x' }])('rejects %j', (query) => {
    expect(paginationQuerySchema.safeParse(query).success).toBe(false);
  });
});
