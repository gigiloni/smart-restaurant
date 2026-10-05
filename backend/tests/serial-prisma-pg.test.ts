import { expect, test, vi } from 'vitest';
import { serializeTransactionQueries } from '../src/database/serial-prisma-pg.js';

test('transaction queries never overlap; failures still permit rollback and independent transactions', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls: string[] = [];
  const queryRaw = vi.fn(async () => {
    calls.push('read');
    await gate;
    throw new Error('query failed');
  });
  const executeRaw = vi.fn(async () => {
    calls.push('write');
    return 1;
  });
  const rollback = vi.fn(async () => {
    calls.push('rollback');
  });
  const transaction = serializeTransactionQueries({
    provider: 'postgres',
    adapterName: 'test',
    options: { usePhantomQuery: false },
    queryRaw,
    executeRaw,
    commit: vi.fn(async () => undefined),
    rollback,
  });
  const first = transaction.queryRaw({ sql: 'SELECT 1', args: [], argTypes: [] });
  const rejected = expect(first).rejects.toThrow('query failed');
  const second = transaction.executeRaw({ sql: 'UPDATE test', args: [], argTypes: [] });
  const cleanup = transaction.rollback();
  await Promise.resolve();
  expect(calls).toEqual(['read']);
  const other = serializeTransactionQueries({
    ...transaction,
    queryRaw: vi.fn(),
    executeRaw: vi.fn(async () => 2),
  });
  await expect(other.executeRaw({ sql: 'SELECT 2', args: [], argTypes: [] })).resolves.toBe(2);
  release();
  await rejected;
  await expect(second).resolves.toBe(1);
  await cleanup;
  expect(calls).toEqual(['read', 'write', 'rollback']);
});
