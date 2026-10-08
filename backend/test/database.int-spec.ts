import { describe, expect, it } from 'vitest';

import { useTestApp } from './support/context.js';
import { sql } from './support/database.js';

const t = useTestApp();

// Constraints the code relies on but cannot express itself.
describe('I-DB database constraints', () => {
  it('01 allows one seated party per table', async () => {
    const table = await t.fixtures.table();
    await t.fixtures.seat(table.id);

    // Error code and constraint name, not the message: that is translated with the server's locale.
    await expect(sql('INSERT INTO "Table_Session" (table_id) VALUES ($1)', [table.id])).rejects.toMatchObject({
      code: '23505',
      constraint: 'Table_Session_one_open_per_table',
    });
  });

  it("02 keeps an order at its session's table", async () => {
    const [table, other] = [await t.fixtures.table(), await t.fixtures.table()];
    const order = await t.fixtures.order(table.id);

    await expect(
      sql('UPDATE "Order" SET table_id = $1 WHERE order_id = $2', [other.id, order.id]),
    ).rejects.toMatchObject({ code: '23503', constraint: 'Order_table_session_id_table_id_fkey' });
  });

  it('03 keeps a single event counter', async () => {
    await expect(sql('INSERT INTO "Order_Event_Counter" (id, value) VALUES (2, 0)')).rejects.toMatchObject({
      code: '23514',
      constraint: 'Order_Event_Counter_single_row',
    });
  });
});
