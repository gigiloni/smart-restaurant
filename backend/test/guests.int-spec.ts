import { beforeAll, describe, expect, it } from 'vitest';

import type { Order, Product, Viewer } from '@smart-restaurant/contracts';

import { GuestAccessService } from '../src/auth/guest-access.service.js';
import { useTestApp } from './support/context.js';
import { eventHead } from './support/database.js';
import { api } from './support/http.js';

const t = useTestApp();
let food: Product;
let drink: Product;

beforeAll(async () => {
  food = await t.fixtures.product('FOOD');
  drink = await t.fixtures.product('DRINK');
});

const oneDish = () => [{ productId: food.id }];

describe('I-GST guests', () => {
  it("01 turns away a wrong token and another table's token", async () => {
    const [table, other] = [await t.fixtures.table(), await t.fixtures.table()];
    const otherToken = (await t.http.get(`/api/tables/${other.id}/qr-code`)).body.token;

    expect((await t.http.post('/api/viewer/guest', { tableId: table.id, token: 'nope' })).status).toBe(403);
    expect((await t.http.post('/api/viewer/guest', { tableId: table.id, token: otherToken })).status).toBe(403);
    // Nobody was seated.
    expect((await t.http.post('/api/table-sessions', { tableId: table.id })).status).toBe(201);
  });

  it('02 seats the first guest and lets the rest of the party join', async () => {
    const table = await t.fixtures.table();

    const first = await t.fixtures.guest(table.id);
    expect(first.response.status).toBe(201);
    expect(String(first.response.headers['set-cookie'])).toMatch(
      /^sr_guest=\d+\.[\w-]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=43200$/,
    );

    const second = await t.fixtures.guest(table.id);
    expect(second.response.status).toBe(200);
    expect(second.session.id).toBe(first.session.id);

    const seatedByStaff = await t.fixtures.seat((await t.fixtures.table()).id);
    expect((await t.fixtures.guest(seatedByStaff.tableId)).session.id).toBe(seatedByStaff.id);
  });

  it('03 tells every caller who they are', async () => {
    expect((await t.http.get('/api/viewer')).body).toBeNull();

    const table = await t.fixtures.table();
    const guest = await t.fixtures.guest(table.id);
    expect((await guest.api.get<Viewer>('/api/viewer')).body).toEqual({
      kind: 'guest',
      tableSessionId: guest.session.id,
      tableId: table.id,
    });

    const bartender = await t.fixtures.staff('BAR');
    expect((await bartender.api.get<Viewer>('/api/viewer')).body).toEqual({
      kind: 'staff',
      employeeId: bartender.employee.id,
      role: 'BAR',
    });

    const both = api(t.app, `${bartender.cookie}; ${guest.cookie}`);
    expect((await both.get<Viewer>('/api/viewer')).body.kind).toBe('staff');
  });

  it('04 lets a guest order for their own table only, unassigned, with at least one item', async () => {
    const [table, other] = [await t.fixtures.table(), await t.fixtures.table()];
    const guest = await t.fixtures.guest(table.id);

    expect((await guest.api.post('/api/orders', { tableId: table.id })).status).toBe(400);
    expect((await guest.api.post('/api/orders', { tableId: table.id, items: [] })).status).toBe(400);
    expect(
      (await guest.api.post('/api/orders', { tableId: table.id, employeeId: 1, items: oneDish() })).status,
    ).toBe(403);
    expect((await guest.api.post('/api/orders', { tableId: other.id, items: oneDish() })).status).toBe(409);

    const order = await guest.api.post<Order>('/api/orders', {
      tableId: table.id,
      employeeId: null,
      items: oneDish(),
    });
    expect(order.status).toBe(201);
    expect(order.body.employeeId).toBeNull();
    // The other table was not seated by the refused order.
    expect((await t.http.post('/api/table-sessions', { tableId: other.id })).status).toBe(201);
  });

  it("05 lets a guest add to their party's orders; other orders do not exist for them", async () => {
    const [table, elsewhere] = [await t.fixtures.table(), await t.fixtures.table()];
    const guest = await t.fixtures.guest(table.id);
    const own = (await guest.api.post<Order>('/api/orders', { tableId: table.id, items: oneDish() })).body;
    const foreign = await t.fixtures.order(elsewhere.id, [food.id]);

    expect((await guest.api.post(`/api/orders/${own.id}/items`, { productId: drink.id })).status).toBe(201);
    expect((await guest.api.post(`/api/orders/${foreign.id}/items`, { productId: drink.id })).status).toBe(404);
  });

  it('06 follows the party to its new table', async () => {
    const [from, to] = [await t.fixtures.table(), await t.fixtures.table()];
    const guest = await t.fixtures.guest(from.id);
    await t.http.patch(`/api/table-sessions/${guest.session.id}`, { tableId: to.id });

    expect((await guest.api.get<Viewer>('/api/viewer')).body).toMatchObject({ tableId: to.id });

    const atOldTable = await guest.api.post('/api/orders', { tableId: from.id, items: oneDish() });
    expect(atOldTable.status).toBe(409);
    expect(atOldTable.body.message).toContain(`seated at table ${to.tableNumber}`);
    expect((await guest.api.post('/api/orders', { tableId: to.id, items: oneDish() })).status).toBe(201);
  });

  it('07 ignores forged cookies', async () => {
    const guest = await t.fixtures.guest((await t.fixtures.table()).id);
    const other = await t.fixtures.guest((await t.fixtures.table()).id);
    const [id, mac] = guest.cookie.split('=')[1].split('.');

    // Both sessions are open, so only the MAC check can turn these away.
    const tampered = `sr_guest=${id}.${mac[0] === 'A' ? 'B' : 'A'}${mac.slice(1)}`;
    const otherSession = `sr_guest=${other.session.id}.${mac}`;
    for (const cookie of [tampered, otherSession]) {
      expect((await api(t.app, cookie).get('/api/viewer')).body).toBeNull();
    }
    expect((await guest.api.get<Viewer>('/api/viewer')).body.kind).toBe('guest');
  });

  it('07b forgets the guest once the table is cleared', async () => {
    const guest = await t.fixtures.guest((await t.fixtures.table()).id);
    await t.http.post(`/api/table-sessions/${guest.session.id}/close`);

    expect((await guest.api.get('/api/viewer')).body).toBeNull();
  });

  it('08 seats a new party, with a new cookie, when someone scans after the table was cleared', async () => {
    const table = await t.fixtures.table();
    const earlier = await t.fixtures.guest(table.id);
    await t.http.post(`/api/table-sessions/${earlier.session.id}/close`);

    const later = await t.fixtures.guest(table.id);

    expect(later.response.status).toBe(201);
    expect(later.session.id).not.toBe(earlier.session.id);
    expect(later.cookie).not.toBe(earlier.cookie);
  });

  // While access control is off, a guest whose table was cleared is simply an
  // anonymous caller, and anonymous callers may order.
  it('09 lets a former guest order anonymously, which seats a new party', async () => {
    const table = await t.fixtures.table();
    const guest = await t.fixtures.guest(table.id);
    await t.http.post(`/api/table-sessions/${guest.session.id}/close`);

    const order = await guest.api.post<Order>('/api/orders', { tableId: table.id, items: oneDish() });

    expect(order.status).toBe(201);
    expect(order.body.tableSessionId).not.toBe(guest.session.id);
  });

  it("10 lets nobody add to their party's order once it is paid", async () => {
    const table = await t.fixtures.table();
    const guest = await t.fixtures.guest(table.id);
    const order = (await guest.api.post<Order>('/api/orders', { tableId: table.id, items: oneDish() })).body;
    await t.fixtures.pay(order);

    expect((await guest.api.post(`/api/orders/${order.id}/items`, { productId: drink.id })).status).toBe(409);
  });

  it('11 answers 400 for a valid token of a table that no longer exists, and seats nobody', async () => {
    const table = await t.fixtures.table();
    const token = t.app.get(GuestAccessService).tableToken(table.id);
    expect((await t.http.delete(`/api/tables/${table.id}`)).status).toBe(200);
    const head = await eventHead();

    const response = await t.http.post('/api/viewer/guest', { tableId: table.id, token });

    expect(response.status).toBe(400);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(await eventHead()).toBe(head);
  });
});
