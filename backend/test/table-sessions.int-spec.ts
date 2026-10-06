import { beforeAll, describe, expect, it } from 'vitest';

import { tableSessionDetailsSchema, type Product, type TableSessionDetails } from '@smart-restaurant/contracts';

import { useTestApp } from './support/context.js';
import { eventHead, eventsAfter, eventTypesAfter } from './support/database.js';

const t = useTestApp();
let food: Product;
let drink: Product;

beforeAll(async () => {
  food = await t.fixtures.product('FOOD');
  drink = await t.fixtures.product('DRINK');
});

describe('I-SES table sessions', () => {
  it('01 seats a party once and joins it afterwards', async () => {
    const table = await t.fixtures.table();
    const head = await eventHead();

    const first = await t.http.post('/api/table-sessions', { tableId: table.id });
    const again = await t.http.post('/api/table-sessions', { tableId: table.id });

    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
    expect(await eventTypesAfter(head)).toEqual(['session.opened']);
  });

  it('02 answers 400 for an unknown table', async () => {
    expect((await t.http.post('/api/table-sessions', { tableId: 999999 })).status).toBe(400);
  });

  it('03 lists seated parties and shows one with its orders', async () => {
    const table = await t.fixtures.table();
    const session = await t.fixtures.seat(table.id);
    await t.fixtures.order(table.id, [food.id]);
    const left = await t.fixtures.seat((await t.fixtures.table()).id);
    expect((await t.http.post(`/api/table-sessions/${left.id}/close`)).status).toBe(200);

    const list = await t.http.get('/api/table-sessions');
    const ids = list.body.map((s: { id: number }) => s.id);
    expect(ids).toContain(session.id);
    expect(ids).not.toContain(left.id);
    expect(list.body.every((s: { closedAt: string | null }) => s.closedAt === null)).toBe(true);

    const detail = await t.http.get<TableSessionDetails>(`/api/table-sessions/${session.id}`);
    tableSessionDetailsSchema.parse(detail.body);
    expect(detail.body.orders).toHaveLength(1);
    expect((await t.http.get('/api/table-sessions/999999')).status).toBe(404);
  });

  it('04 moves a party with all its orders to a free table', async () => {
    const [from, to] = [await t.fixtures.table(), await t.fixtures.table()];
    const order = await t.fixtures.order(from.id, [food.id]);
    const head = await eventHead();

    const response = await t.http.patch<TableSessionDetails>(`/api/table-sessions/${order.tableSessionId}`, {
      tableId: to.id,
    });

    expect(response.status).toBe(200);
    expect(response.body.tableId).toBe(to.id);
    expect(response.body.orders[0].tableId).toBe(to.id);
    expect((await t.http.get(`/api/orders/${order.id}`)).body.tableId).toBe(to.id);

    const [moved, ...rest] = await eventsAfter(head);
    expect(rest).toEqual([]);
    expect(moved).toMatchObject({ type: 'session.moved', productTypes: ['FOOD'] });
    expect(moved.payload.previousTableId).toBe(from.id);

    // The table they left is free again.
    expect((await t.http.post('/api/table-sessions', { tableId: from.id })).status).toBe(201);
  });

  it('05 refuses a move to an occupied or unknown table and ignores a move to the same table', async () => {
    const [mine, taken] = [await t.fixtures.table(), await t.fixtures.table()];
    const session = await t.fixtures.seat(mine.id);
    await t.fixtures.seat(taken.id);
    const url = `/api/table-sessions/${session.id}`;

    expect((await t.http.patch(url, { tableId: taken.id })).status).toBe(409);
    expect((await t.http.patch(url, { tableId: 999999 })).status).toBe(400);

    const head = await eventHead();
    expect((await t.http.patch(url, { tableId: mine.id })).status).toBe(200);
    expect(await eventHead()).toBe(head);
  });

  it('06 clears the table only once every order is paid', async () => {
    const table = await t.fixtures.table();
    const order = await t.fixtures.order(table.id, [drink.id]);
    const url = `/api/table-sessions/${order.tableSessionId}/close`;

    expect((await t.http.post(url)).status).toBe(409);

    await t.fixtures.pay(order);
    const head = await eventHead();
    const cleared = await t.http.post(url);
    expect(cleared.status).toBe(200);
    expect(cleared.body.closedAt).not.toBeNull();

    // Idempotent: clearing again changes nothing.
    expect((await t.http.post(url)).status).toBe(200);
    expect(await eventTypesAfter(head)).toEqual(['session.closed']);

    expect(
      (await t.http.patch(`/api/table-sessions/${order.tableSessionId}`, { tableId: table.id })).status,
    ).toBe(409);

    const next = await t.http.post('/api/table-sessions', { tableId: table.id });
    expect(next.status).toBe(201);
    expect(next.body.id).not.toBe(order.tableSessionId);
    expect((await t.http.post('/api/table-sessions/999999/close')).status).toBe(404);
  });

  it('07 clears a table where nobody ordered', async () => {
    const session = await t.fixtures.seat((await t.fixtures.table()).id);

    expect((await t.http.post(`/api/table-sessions/${session.id}/close`)).status).toBe(200);
  });
});
