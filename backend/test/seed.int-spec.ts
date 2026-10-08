import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  employeeSchema,
  liveSnapshotSchema,
  orderSchema,
  productSchema,
  tableSchema,
  type Order,
  type Table,
} from '@smart-restaurant/contracts';

import { useTestApp } from './support/context.js';
import { count, eventHead, sql } from './support/database.js';

const t = useTestApp();

beforeAll(async () => {
  await sql(await readFile(new URL('../prisma/seed.sql', import.meta.url), 'utf8'));
});

const distinct = async (column: string, table: string) =>
  (await sql<{ value: string }>(`SELECT DISTINCT ${column}::text AS value FROM "${table}" ORDER BY 1`)).map(
    (row) => row.value,
  );

// The sample data in backend/prisma/seed.sql is what the team develops and
// demonstrates against. It must keep loading as the schema changes.
describe('I-SEED sample data', () => {
  it('01 loads on the migrated schema, with an empty event log', async () => {
    for (const table of ['Table', 'Employee', 'Product', 'Ingredient', 'Order', 'Order_Item']) {
      expect(await count(table)).toBeGreaterThan(0);
    }
    expect(await eventHead()).toBe(0);
  });

  it('02 covers every enum value, as the README promises', async () => {
    expect(await distinct('role', 'Employee')).toEqual(['ADMIN', 'BAR', 'KITCHEN', 'SERVICE']);
    expect(await distinct('type', 'Product')).toEqual(['APPETIZER', 'DRINK', 'FOOD']);
    expect(await distinct('status', 'Order_Item')).toEqual(['IN_PROGRESS', 'OPEN', 'READY', 'REMAKE', 'SERVED']);
  });

  it('03 reads back through the API in the contract shapes', async () => {
    for (const [url, schema] of [
      ['/api/tables', tableSchema],
      ['/api/employees', employeeSchema],
      ['/api/products', productSchema],
      ['/api/orders?take=200', orderSchema],
    ] as const) {
      const response = await t.http.get<unknown[]>(url);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
      response.body.forEach((row) => schema.parse(row));
    }

    liveSnapshotSchema.parse((await t.http.get('/api/live/snapshot')).body);
  });

  it('04 leaves the id sequences ready for new rows', async () => {
    const tables = (await t.http.get<Table[]>('/api/tables')).body;
    const created = await t.http.post<Table>('/api/tables', { tableNumber: 999 });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeGreaterThan(Math.max(...tables.map((table) => table.id)));

    const order = await t.http.post<Order>('/api/orders', {
      tableId: created.body.id,
      items: [{ productId: 1 }],
    });
    expect(order.status).toBe(201);
  });
});
