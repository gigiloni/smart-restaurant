import { expect, test } from 'vitest';
import { restoreCart, priceInCents } from '../src/app/services/cart-state.ts';
test('cart reload retains IDs and quantities, excluding copied product prices', () => {
  expect(
    restoreCart(
      JSON.stringify({ version: 1, lines: [{ productId: 4, quantity: 2, price: '0.01' }] }),
    ),
  ).toEqual([{ productId: 4, quantity: 2 }]);
});
test('corrupt, duplicate, negative, overflowing and obsolete storage is rejected', () => {
  for (const value of [
    'bad JSON',
    'null',
    '[1,5,10]',
    '{"version":2,"lines":[]}',
    '{"version":1,"lines":[{"productId":1,"quantity":-1}]}',
    '{"version":1,"lines":[{"productId":1,"quantity":100}]}',
    '{"version":1,"lines":[{"productId":1,"quantity":1},{"productId":1,"quantity":2}]}',
    '{"version":1,"lines":[{"productId":1,"quantity":99},{"productId":2,"quantity":99},{"productId":3,"quantity":3}]}',
  ])
    expect(restoreCart(value)).toEqual([]);
});
test('decimal API prices produce exact cent totals', () => {
  expect(priceInCents('0.10') * 3 + priceInCents('0.20')).toBe(50);
  expect(priceInCents('12.5')).toBe(1250);
  expect(priceInCents('8')).toBe(800);
  expect(() => priceInCents('NaN')).toThrow();
});
