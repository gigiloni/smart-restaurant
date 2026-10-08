import { describe, expect, it } from 'vitest';

import { errorResponseSchema, tableSchema, type Table } from '@smart-restaurant/contracts';

import { useTestApp } from './support/context.js';

const t = useTestApp();

describe('I-TBL tables', () => {
  it('01 lists tables sorted by number', async () => {
    for (const tableNumber of [30, 10, 20]) {
      expect((await t.http.post('/api/tables', { tableNumber })).status).toBe(201);
    }

    const response = await t.http.get<Table[]>('/api/tables');

    expect(response.status).toBe(200);
    expect(response.body.map((table) => table.tableNumber)).toEqual([10, 20, 30]);
    response.body.forEach((table) => tableSchema.parse(table));
  });

  it('02 answers 404 for an unknown table and 400 for a malformed id', async () => {
    const unknown = await t.http.get('/api/tables/999999');
    expect(unknown.status).toBe(404);
    errorResponseSchema.parse(unknown.body);

    const malformed = await t.http.get('/api/tables/abc');
    expect(malformed.status).toBe(400);
    expect(Array.isArray(malformed.body.message)).toBe(true);

    expect((await t.http.get('/api/tables/2147483648')).status).toBe(400);
  });

  it('03 creates a table with 0 seats unless told otherwise', async () => {
    const response = await t.http.post('/api/tables', { tableNumber: 77 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ tableNumber: 77, seats: 0 });
  });

  it('04 keeps table numbers unique', async () => {
    expect((await t.http.post('/api/tables', { tableNumber: 88 })).status).toBe(201);
    expect((await t.http.post('/api/tables', { tableNumber: 88 })).status).toBe(409);

    const other = await t.fixtures.table();
    expect((await t.http.patch(`/api/tables/${other.id}`, { tableNumber: 88 })).status).toBe(409);
  });

  it('05 updates the fields sent and rejects an empty update', async () => {
    const table = await t.fixtures.table();

    expect((await t.http.patch(`/api/tables/${table.id}`, {})).status).toBe(400);
    expect((await t.http.patch('/api/tables/999999', { seats: 2 })).status).toBe(404);

    const response = await t.http.patch(`/api/tables/${table.id}`, { seats: 6 });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...table, seats: 6 });
  });

  it('06 deletes an unused table and returns it', async () => {
    const table = await t.fixtures.table();

    const response = await t.http.delete(`/api/tables/${table.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(table);
    expect((await t.http.get(`/api/tables/${table.id}`)).status).toBe(404);
  });

  it('07 keeps a table that has seated a party', async () => {
    const table = await t.fixtures.table();
    await t.fixtures.seat(table.id);

    expect((await t.http.delete(`/api/tables/${table.id}`)).status).toBe(409);
  });

  it('08 hands out the QR code content', async () => {
    const table = await t.fixtures.table();

    const response = await t.http.get(`/api/tables/${table.id}/qr-code`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ tableId: table.id, tableNumber: table.tableNumber });
    expect(response.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await t.http.get('/api/tables/999999/qr-code')).status).toBe(404);
  });

  it('09 ignores fields that are not part of the payload', async () => {
    const response = await t.http.post('/api/tables', { tableNumber: 78, id: 999999, foo: 1 });

    expect(response.status).toBe(201);
    expect(response.body.id).not.toBe(999999);
    expect(response.body).not.toHaveProperty('foo');
  });
});
