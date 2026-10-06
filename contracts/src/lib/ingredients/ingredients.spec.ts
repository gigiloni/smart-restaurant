import { describe, expect, it } from 'vitest';

import { createIngredientSchema } from './create-ingredient.schema.js';
import { updateIngredientSchema } from './update-ingredient.schema.js';

describe('U-CT-10 ingredient payloads', () => {
  it('trims the name', () => {
    expect(createIngredientSchema.parse({ name: ' Salt ' }).name).toBe('Salt');
  });

  it.each([{ name: '   ' }, { name: 'x'.repeat(101) }, {}])('rejects %j', (body) => {
    expect(createIngredientSchema.safeParse(body).success).toBe(false);
  });

  it('rejects an empty update', () => {
    expect(updateIngredientSchema.safeParse({}).success).toBe(false);
  });
});
