import { describe, expect, it } from 'vitest';

import { productSchema, type Ingredient, type Product } from '@smart-restaurant/contracts';

import { useTestApp } from './support/context.js';
import { count, eventHead } from './support/database.js';

const t = useTestApp();

const ids = (products: Product[]) => products.map((p) => p.id).sort((a, b) => a - b);
const recipeOf = (product: Product) => product.ingredients.map((line) => line.ingredientId);

describe('I-ING ingredients', () => {
  it('01 creates, lists by name, updates and deletes', async () => {
    const created = await t.http.post<Ingredient>('/api/ingredients', { name: '  Zimt ' });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Zimt');
    await t.fixtures.ingredient('Anis');

    const list = await t.http.get<Ingredient[]>('/api/ingredients');
    expect(list.body.map((i) => i.name)).toEqual(['Anis', 'Zimt']);

    const url = `/api/ingredients/${created.body.id}`;
    expect((await t.http.patch(url, { name: 'Zimtstange' })).body.name).toBe('Zimtstange');
    expect((await t.http.delete(url)).status).toBe(200);
    expect((await t.http.get(url)).status).toBe(404);
  });

  it('02 keeps an ingredient a recipe uses', async () => {
    const used = await t.fixtures.ingredient();
    await t.fixtures.product('FOOD', { ingredients: [{ ingredientId: used.id, amount: 1 }] });

    expect((await t.http.delete(`/api/ingredients/${used.id}`)).status).toBe(409);
  });
});

describe('I-PRD products', () => {
  it('01 lists products by name with their recipes', async () => {
    const flour = await t.fixtures.ingredient('Flour');
    await t.fixtures.product('FOOD', { name: 'Ciabatta', ingredients: [{ ingredientId: flour.id, amount: 200 }] });
    await t.fixtures.product('DRINK', { name: 'Acqua' });

    const response = await t.http.get<Product[]>('/api/products');

    expect(response.status).toBe(200);
    response.body.forEach((product) => productSchema.parse(product));
    const names = response.body.map((p) => p.name);
    expect(names.indexOf('Acqua')).toBeLessThan(names.indexOf('Ciabatta'));
    expect(response.body.find((p) => p.name === 'Ciabatta')?.ingredients[0].ingredient.name).toBe('Flour');
  });

  it('02 narrows the list with ?ids=', async () => {
    const [a, b, c] = [await t.fixtures.product(), await t.fixtures.product(), await t.fixtures.product()];

    const list = await t.http.get<Product[]>(`/api/products?ids=${c.id},${a.id},${c.id},999999`);
    expect(list.status).toBe(200);
    expect(ids(list.body)).toEqual([a.id, c.id]);

    const repeated = await t.http.get<Product[]>(`/api/products?ids=${b.id}&ids=${a.id}`);
    expect(ids(repeated.body)).toEqual([a.id, b.id]);

    expect((await t.http.get('/api/products?ids=abc')).status).toBe(400);
    const tooMany = Array.from({ length: 101 }, (_, i) => i + 1).join(',');
    expect((await t.http.get(`/api/products?ids=${tooMany}`)).status).toBe(400);
  });

  it('03 looks products up by id with POST /products-by-id', async () => {
    const [a, b] = [await t.fixtures.product(), await t.fixtures.product()];

    const response = await t.http.post<Product[]>('/api/products-by-id', { ids: [b.id, a.id] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual((await t.http.get(`/api/products?ids=${b.id},${a.id}`)).body);
    expect((await t.http.post('/api/products-by-id', { ids: [] })).status).toBe(400);
    expect((await t.http.post('/api/products-by-id', {})).status).toBe(400);
  });

  it('04 creates a product with its recipe', async () => {
    const flour = await t.fixtures.ingredient('Mehl');

    const response = await t.http.post<Product>('/api/products', {
      name: 'Brot',
      price: 3.5,
      type: 'APPETIZER',
      ingredients: [{ ingredientId: flour.id, amount: 200 }],
    });

    expect(response.status).toBe(201);
    // numeric is read back as a decimal string, without padding.
    expect(response.body.price).toBe('3.5');
    expect(response.body.ingredients[0]).toMatchObject({
      ingredientId: flour.id,
      amount: 200,
      ingredient: { name: 'Mehl' },
    });
  });

  it('05 rejects an unknown or repeated ingredient and creates nothing', async () => {
    const before = await count('Product');
    const known = await t.fixtures.ingredient();

    const unknown = await t.http.post('/api/products', {
      name: 'Ghost',
      price: 1,
      type: 'FOOD',
      ingredients: [{ ingredientId: 999999 }],
    });
    const repeated = await t.http.post('/api/products', {
      name: 'Twice',
      price: 1,
      type: 'FOOD',
      ingredients: [{ ingredientId: known.id }, { ingredientId: known.id }],
    });

    expect(unknown.status).toBe(400);
    expect(repeated.status).toBe(400);
    expect(await count('Product')).toBe(before);
  });

  it('06 replaces the recipe only when ingredients are sent', async () => {
    const [first, second] = [await t.fixtures.ingredient(), await t.fixtures.ingredient()];
    const product = await t.fixtures.product('FOOD', { ingredients: [{ ingredientId: first.id, amount: 1 }] });
    const url = `/api/products/${product.id}`;

    expect(recipeOf((await t.http.patch<Product>(url, { price: 2 })).body)).toEqual([first.id]);
    expect(
      recipeOf((await t.http.patch<Product>(url, { ingredients: [{ ingredientId: second.id, amount: 5 }] })).body),
    ).toEqual([second.id]);
    expect((await t.http.patch<Product>(url, { ingredients: [] })).body.ingredients).toEqual([]);
    expect((await t.http.patch<Product>(url, { description: null })).body.description).toBeNull();
  });

  it('07 leaves the recipe alone when a replacement fails', async () => {
    const kept = await t.fixtures.ingredient();
    const product = await t.fixtures.product('FOOD', { ingredients: [{ ingredientId: kept.id, amount: 1 }] });

    const response = await t.http.patch(`/api/products/${product.id}`, {
      ingredients: [{ ingredientId: 999999 }],
    });

    expect(response.status).toBe(400);
    expect(recipeOf((await t.http.get<Product>(`/api/products/${product.id}`)).body)).toEqual([kept.id]);
  });

  it('08 deletes the recipe with the product, but keeps ordered products', async () => {
    const product = await t.fixtures.product('FOOD', {
      ingredients: [{ ingredientId: (await t.fixtures.ingredient()).id, amount: 1 }],
    });
    expect((await t.http.delete(`/api/products/${product.id}`)).status).toBe(200);
    expect(await count('Product_Ingredient', 'product_id = $1', [product.id])).toBe(0);

    const ordered = await t.fixtures.product();
    await t.fixtures.order((await t.fixtures.table()).id, [ordered.id]);
    expect((await t.http.delete(`/api/products/${ordered.id}`)).status).toBe(409);
  });

  it('09 writes no order events for menu changes', async () => {
    const head = await eventHead();

    await t.fixtures.product();
    await t.fixtures.table();

    expect(await eventHead()).toBe(head);
  });
});
