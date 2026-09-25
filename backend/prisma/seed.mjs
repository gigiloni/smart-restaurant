import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

if (process.env.NODE_ENV === 'production') {
  throw new Error('The sample seed resets data and cannot run in production.');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const sql = await readFile(new URL('./seed.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(sql);
  console.log('Sample restaurant data loaded.');
} finally {
  await client.end();
}
