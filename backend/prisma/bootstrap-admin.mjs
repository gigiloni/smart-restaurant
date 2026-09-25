import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import pg from 'pg';

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!process.env.DATABASE_URL || !email || !password || password.length < 12) {
  throw new Error(
    'DATABASE_URL, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (12+ characters) are required.',
  );
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const passwordHash = await hashPassword(password);

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('smart-restaurant-bootstrap-admin'))");

  const existing = await client.query(
    'SELECT employee_id FROM "Employee" WHERE role = $1 AND auth_user_id IS NOT NULL LIMIT 1',
    ['ADMIN'],
  );
  if (existing.rowCount) throw new Error('An active admin already exists.');

  const unlinked = await client.query(
    'SELECT employee_id, firstname, lastname FROM "Employee" WHERE role = $1 AND auth_user_id IS NULL ORDER BY employee_id LIMIT 1 FOR UPDATE',
    ['ADMIN'],
  );
  let employee = unlinked.rows[0];
  if (!employee) {
    const firstname = process.env.BOOTSTRAP_ADMIN_FIRSTNAME?.trim();
    const lastname = process.env.BOOTSTRAP_ADMIN_LASTNAME?.trim();
    if (!firstname || !lastname)
      throw new Error(
        'BOOTSTRAP_ADMIN_FIRSTNAME and BOOTSTRAP_ADMIN_LASTNAME are required when there is no existing admin employee.',
      );
    const inserted = await client.query(
      'INSERT INTO "Employee" (firstname, lastname, role) VALUES ($1, $2, $3) RETURNING employee_id, firstname, lastname',
      [firstname, lastname, 'ADMIN'],
    );
    employee = inserted.rows[0];
  }

  const userId = randomUUID();
  await client.query(
    'INSERT INTO "user" (id, name, email, "emailVerified", "updatedAt") VALUES ($1, $2, $3, false, NOW())',
    [userId, `${employee.firstname} ${employee.lastname}`, email],
  );
  await client.query(
    'INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW())',
    [randomUUID(), userId, 'credential', userId, passwordHash],
  );
  await client.query('UPDATE "Employee" SET auth_user_id = $1 WHERE employee_id = $2', [
    userId,
    employee.employee_id,
  ]);
  await client.query('COMMIT');
  console.log(`Admin login created for employee ${employee.employee_id}.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
