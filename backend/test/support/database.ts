import pg from 'pg';

import type { Json } from './http.js';

/** Runs one statement on the test database outside the application. */
export async function sql<Row = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<Row[]> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    return (await client.query(text, params)).rows as Row[];
  } finally {
    await client.end();
  }
}

/**
 * Empties every table and restarts the ids. The event counter row stays (it is
 * created by a migration) and goes back to 0.
 */
export async function resetDatabase(): Promise<void> {
  await sql(`
    TRUNCATE TABLE
      "Order_Event", "Order_Item", "Order", "Table_Session", "Product_Ingredient",
      "Product", "Ingredient", "Table", "Employee", "session", "account", "verification", "user"
    RESTART IDENTITY CASCADE;
    UPDATE "Order_Event_Counter" SET value = 0 WHERE id = 1;
  `);
}

/** Id of the newest order event, which is also what the live snapshot calls its cursor. */
export async function eventHead(): Promise<number> {
  const [row] = await sql<{ value: number }>(
    'SELECT value::int AS value FROM "Order_Event_Counter" WHERE id = 1',
  );

  return row.value;
}

export interface StoredEvent {
  id: number;
  type: string;
  occurredAt: Date;
  tableSessionId: number;
  orderId: number | null;
  orderItemId: number | null;
  productType: string | null;
  productTypes: string[];
  payload: Json;
}

/** Events written after `id`, oldest first. */
export function eventsAfter(id: number): Promise<StoredEvent[]> {
  // The id is bigint and the enum array has no parser in node-postgres: cast both.
  return sql<StoredEvent>(
    `SELECT order_event_id::int AS id, type, occurred_at AS "occurredAt",
       table_session_id AS "tableSessionId", order_id AS "orderId",
       order_item_id AS "orderItemId", product_type::text AS "productType",
       product_types::text[] AS "productTypes", payload
     FROM "Order_Event" WHERE order_event_id > $1 ORDER BY order_event_id`,
    [id],
  );
}

export async function eventTypesAfter(id: number): Promise<string[]> {
  return (await eventsAfter(id)).map((event) => event.type);
}

export async function count(table: string, where = 'TRUE', params: unknown[] = []): Promise<number> {
  const [row] = await sql<{ n: number }>(
    `SELECT count(*)::int AS n FROM "${table}" WHERE ${where}`,
    params,
  );

  return row.n;
}
