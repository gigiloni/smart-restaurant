import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { imageForProduct } from './product-images.ts';

test('all seed products have a local image and a documented source', () => {
  const sql = readFileSync('backend/prisma/seed.sql', 'utf8');
  const products = sql.split('INSERT INTO "Product"')[1].split(';')[0];
  const names = [...products.matchAll(/\(\d+,\s*'([^']+)'/g)].map((match) => match[1]);
  const credits = JSON.parse(
    readFileSync('apps/gastro-ui/public/dishes/image-credits.json', 'utf8'),
  );
  assert.equal(names.length, 20);
  for (const name of names) {
    const src = imageForProduct(name);
    assert.notEqual(src, '/dishes/placeholder.svg', name);
    assert.ok(existsSync('apps/gastro-ui/public' + src), name);
    const credit = credits.find((entry: { src: string }) => entry.src === src);
    assert.ok(credit?.author && credit?.source && credit?.license && credit?.licenseUrl, name);
  }
});

test('accent variants resolve correctly and unknown dishes use a neutral placeholder', () => {
  assert.equal(imageForProduct('Tiramisù'), imageForProduct('Tiramisu'));
  assert.equal(imageForProduct('  TAGLIATELLE AL RAGU  '), '/dishes/tagliatelle-ragu.jpg');
  assert.equal(imageForProduct('A newly added dish'), '/dishes/placeholder.svg');
  assert.ok(existsSync('apps/gastro-ui/public/dishes/placeholder.svg'));
});
