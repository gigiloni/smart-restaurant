import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreCart, priceInCents } from './cart-state.ts';
test('cart reload retains IDs and quantities, excluding copied product prices', () => {
  assert.deepEqual(
    restoreCart(
      JSON.stringify({ version: 1, lines: [{ productId: 4, quantity: 2, price: '0.01' }] }),
    ),
    [{ productId: 4, quantity: 2 }],
  );
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
    assert.deepEqual(restoreCart(value), []);
});
test('decimal API prices produce exact cent totals', () => {
  assert.equal(priceInCents('0.10') * 3 + priceInCents('0.20'), 50);
  assert.equal(priceInCents('12.5'), 1250);
  assert.equal(priceInCents('8'), 800);
  assert.throws(() => priceInCents('NaN'));
});
