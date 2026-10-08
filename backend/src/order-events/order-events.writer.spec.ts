import { Test } from '@nestjs/testing';
import { ClsPluginTransactional, NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';
import { ClsModule } from 'nestjs-cls';
import { describe, expect, it, vi } from 'vitest';

import { RowLocks } from '../database/row-locks.js';
import { OrderEventsWriter } from './order-events.writer.js';

/** The writer and row locks on a fake client, with transactions that only mark themselves active. */
async function build() {
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([{ value: 7n }]),
    $executeRaw: vi.fn().mockResolvedValue(1),
    orderEvent: { create: vi.fn().mockResolvedValue({}) },
    order: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 1,
        tableSessionId: 2,
        tableId: 3,
        status: 'OPEN',
        table: { tableNumber: 12 },
      }),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue([
        { product: { type: 'FOOD' } },
        { product: { type: 'FOOD' } },
        { product: { type: 'DRINK' } },
      ]),
    },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [
      ClsModule.forRoot({
        global: true,
        plugins: [
          new ClsPluginTransactional({
            adapter: new NoOpTransactionalAdapter({ tx: db, disableWarning: true }),
          }),
        ],
      }),
    ],
    providers: [OrderEventsWriter, RowLocks],
  }).compile();

  const host = moduleRef.get(TransactionHost);

  return {
    db,
    writer: moduleRef.get(OrderEventsWriter),
    locks: moduleRef.get(RowLocks),
    inTransaction: <T>(fn: () => Promise<T>) => host.withTransaction(fn),
    /** The data passed to `orderEvent.create`. */
    stored: () => db.orderEvent.create.mock.calls[0][0].data,
  };
}

/** Runs `fn` and turns a synchronous throw into a rejection. */
const attempt = (fn: () => unknown) => Promise.resolve().then(fn);
const NO_TRANSACTION = 'no existing transaction is active';

const order = {
  id: 1,
  tableSessionId: 2,
  orderItems: (['FOOD', 'DRINK', 'FOOD'] as const).map((type) => ({ product: { type } })),
};
const item = { id: 4, orderId: 1, product: { type: 'DRINK' as const } };

describe('U-EVW OrderEventsWriter', () => {
  it('01 refuses to write an event outside a transaction', async () => {
    const { writer, db } = await build();

    await expect(attempt(() => writer.sessionOpened({ id: 2 }))).rejects.toThrow(NO_TRANSACTION);
    expect(db.orderEvent.create).not.toHaveBeenCalled();
  });

  it('02 numbers the event from the counter and notifies listeners', async () => {
    const { writer, db, inTransaction, stored } = await build();

    await expect(inTransaction(() => writer.sessionOpened({ id: 2 }))).resolves.toBe(7n);

    expect(stored()).toMatchObject({ id: 7n, type: 'session.opened', tableSessionId: 2, productTypes: [] });
    expect(db.$executeRaw).toHaveBeenCalledOnce();
  });

  it('03 stores the distinct product types of an order, for kitchen and bar', async () => {
    const { writer, inTransaction, stored } = await build();

    await inTransaction(() => writer.orderCreated(order));

    expect(stored()).toMatchObject({ type: 'order.created', orderId: 1, productTypes: ['FOOD', 'DRINK'] });
    expect(stored().payload).toEqual({ order });
  });

  it('04 stores an item event with its product type and a reference to its order', async () => {
    const { writer, inTransaction, stored } = await build();

    await inTransaction(() => writer.itemStatusChanged(item, 'OPEN'));

    expect(stored()).toMatchObject({
      type: 'item.status_changed',
      tableSessionId: 2,
      orderId: 1,
      orderItemId: 4,
      productType: 'DRINK',
    });
    expect(stored().payload).toEqual({
      item,
      order: { id: 1, tableSessionId: 2, tableId: 3, tableNumber: 12, status: 'OPEN' },
      previousStatus: 'OPEN',
    });
  });

  it("05 stores a move with the table left and the open orders' product types", async () => {
    const { writer, db, inTransaction, stored } = await build();

    await inTransaction(() => writer.sessionMoved({ id: 2 }, 5));

    expect(db.orderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { order: { tableSessionId: 2, status: 'OPEN' } } }),
    );
    expect(stored()).toMatchObject({ type: 'session.moved', productTypes: ['FOOD', 'DRINK'] });
    expect(stored().payload).toEqual({ session: { id: 2 }, previousTableId: 5 });
  });

  it('06 stores dates as the API returns them, as ISO strings', async () => {
    const { writer, inTransaction, stored } = await build();
    const openedAt = new Date('2026-10-01T12:00:00.000Z');

    await inTransaction(() => writer.sessionOpened({ id: 2, openedAt } as { id: number }));

    expect(stored().payload).toEqual({ session: { id: 2, openedAt: '2026-10-01T12:00:00.000Z' } });
  });
});

describe('U-RL RowLocks', () => {
  it('01 refuses to lock outside a transaction, where the lock would protect nothing', async () => {
    const { locks, db } = await build();

    await expect(attempt(() => locks.order(1))).rejects.toThrow(NO_TRANSACTION);
    await expect(attempt(() => locks.tableSession(1))).rejects.toThrow(NO_TRANSACTION);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it('02 returns the locked row, or null when there is none', async () => {
    const { locks, db, inTransaction } = await build();
    db.$queryRaw.mockResolvedValueOnce([{ id: 1, status: 'OPEN' }]).mockResolvedValueOnce([]);

    await expect(inTransaction(() => locks.order(1))).resolves.toEqual({ id: 1, status: 'OPEN' });
    await expect(inTransaction(() => locks.tableSession(1))).resolves.toBeNull();
  });
});
