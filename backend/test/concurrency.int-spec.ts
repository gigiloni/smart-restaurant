import { beforeAll, describe, expect, it } from 'vitest';

import type { Product, TableSession } from '@smart-restaurant/contracts';

import { useTestApp } from './support/context.js';
import { count, eventHead, sql } from './support/database.js';
import { PASSWORD } from './support/fixtures.js';

const t = useTestApp();
let food: Product;
let drink: Product;

/** Each race runs this often; a missing lock shows up within a few rounds. */
const ROUNDS = 10;

beforeAll(async () => {
  food = await t.fixtures.product('FOOD');
  drink = await t.fixtures.product('DRINK');
});

describe('I-CON concurrent requests', () => {
  it('01 seats one party when a free table is scanned and seated at once', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const table = await t.fixtures.table();
      const { token } = (await t.http.get(`/api/tables/${table.id}/qr-code`)).body;

      const responses = await Promise.all([
        t.http.post<TableSession>('/api/table-sessions', { tableId: table.id }),
        t.http.post<TableSession>('/api/viewer/guest', { tableId: table.id, token }),
        t.http.post<TableSession>('/api/table-sessions', { tableId: table.id }),
        t.http.post<TableSession>('/api/viewer/guest', { tableId: table.id, token }),
      ]);

      expect(new Set(responses.map((r) => r.body.id)).size).toBe(1);
      expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
      expect(
        await count('Order_Event', `type = 'session.opened' AND table_session_id = $1`, [responses[0].body.id]),
      ).toBe(1);
    }
  });

  it('02 never adds an item to an order that is being paid', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const order = await t.fixtures.order((await t.fixtures.table()).id, [drink.id]);
      await t.fixtures.serveAll(order);

      const [add, pay] = await Promise.all([
        t.http.post(`/api/orders/${order.id}/items`, { productId: food.id }),
        t.http.post(`/api/orders/${order.id}/close`),
      ]);

      // Either the item got in first and blocks payment, or payment won and the order is frozen.
      expect([
        [201, 409],
        [409, 200],
      ]).toContainEqual([add.status, pay.status]);
      expect(
        await count(
          'Order_Item',
          `order_id = $1 AND status <> 'SERVED' AND EXISTS (SELECT 1 FROM "Order" o WHERE o.order_id = $1 AND o.status = 'CLOSED')`,
          [order.id],
        ),
      ).toBe(0);
    }
  });

  it('03 never places an order in a party that is leaving', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const table = await t.fixtures.table();
      const session = await t.fixtures.seat(table.id);

      const [order, clear] = await Promise.all([
        t.http.post('/api/orders', { tableId: table.id }),
        t.http.post(`/api/table-sessions/${session.id}/close`),
      ]);

      expect(order.status).toBe(201);
      expect([200, 409]).toContain(clear.status);
    }

    expect(
      await count(
        'Order',
        `status = 'OPEN' AND EXISTS (SELECT 1 FROM "Table_Session" s WHERE s.table_session_id = "Order".table_session_id AND s.closed_at IS NOT NULL)`,
      ),
    ).toBe(0);
  });

  it('04 applies a repeated status move exactly once', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const order = await t.fixtures.order((await t.fixtures.table()).id, [food.id]);
      const [item] = order.orderItems;

      const responses = await Promise.all(
        Array.from({ length: 3 }, () =>
          t.http.patch(`/api/orders/${order.id}/items/${item.id}`, { status: 'IN_PROGRESS' }),
        ),
      );

      expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
      expect(
        await count('Order_Event', `type = 'item.status_changed' AND order_item_id = $1`, [item.id]),
      ).toBe(1);
    }
  });

  it('05 hands out event ids without gaps under concurrent writers', async () => {
    const head = await eventHead();
    const tables = await Promise.all(Array.from({ length: 6 }, () => t.fixtures.table()));

    await Promise.all(tables.map((table) => t.fixtures.order(table.id, [food.id, drink.id])));

    const ids = (
      await sql<{ id: number }>(
        'SELECT order_event_id::int AS id FROM "Order_Event" WHERE order_event_id > $1 ORDER BY 1',
        [head],
      )
    ).map((row) => row.id);
    // Six tables: session.opened and order.created each.
    expect(ids).toEqual(Array.from({ length: 12 }, (_, i) => head + i + 1));
  });

  it('06 keeps one admin when two demote each other at once', async () => {
    for (let round = 0; round < 5; round++) {
      await sql(`UPDATE "Employee" SET role = 'SERVICE' WHERE role = 'ADMIN'`);
      const admins = await Promise.all(
        ['a', 'b'].map((who) =>
          t.http.post('/api/employees', {
            firstname: who,
            lastname: String(round),
            role: 'ADMIN',
            email: `${who}${round}@race.test`,
            password: PASSWORD,
          }),
        ),
      );

      const responses = await Promise.all(
        admins.map((admin) => t.http.patch(`/api/employees/${admin.body.id}`, { role: 'BAR' })),
      );

      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    }
  });

  it('07 leaves no orphaned items when an order is deleted while items are added', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const order = await t.fixtures.order((await t.fixtures.table()).id, [food.id]);

      const [add, remove] = await Promise.all([
        t.http.post(`/api/orders/${order.id}/items`, { productId: food.id }),
        t.http.delete(`/api/orders/${order.id}`),
      ]);

      expect(remove.status).toBe(200);
      expect([201, 404]).toContain(add.status);
      expect(await count('Order_Item', 'order_id = $1', [order.id])).toBe(0);
      if (add.status === 201) {
        expect(remove.body.orderItems).toHaveLength(2);
      }
    }
  });
});
