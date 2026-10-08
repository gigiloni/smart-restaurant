import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { OrderItemStatus, ProductType } from '@smart-restaurant/contracts';

import { prismaError, withTransactions } from '../../test/support/unit.js';
import { OrderEventsWriter } from '../order-events/order-events.writer.js';
import { OrderLock } from '../orders/order-lock.js';
import { OrdersService } from '../orders/orders.service.js';
import { OrderItemsRepository } from './order-items.repository.js';
import { OrderItemsService } from './order-items.service.js';

const service = (c: { orderLock?: object; events?: object; repository?: object } = {}) =>
  withTransactions(OrderItemsService, [
    { provide: OrderLock, useValue: c.orderLock ?? { forChange: vi.fn().mockResolvedValue({}) } },
    { provide: OrderEventsWriter, useValue: c.events ?? {} },
    { provide: OrderItemsRepository, useValue: c.repository ?? {} },
    { provide: OrdersService, useValue: {} },
  ]);

const item = (status: OrderItemStatus, type: ProductType = 'FOOD') => ({
  id: 4,
  orderId: 1,
  status,
  product: { type },
});
const finding = (found: object | null) => vi.fn().mockResolvedValue(found);

describe('U-SV-ITM status changes', () => {
  it('01 refuses a forbidden move with 409, naming the permitted moves and why a skip is refused', async () => {
    const items = await service({ repository: { findByOrderAndId: finding(item('OPEN')) } });
    const move = items.update(1, 4, { status: 'SERVED' });

    await expect(move).rejects.toBeInstanceOf(ConflictException);
    await expect(move).rejects.toThrow(
      'cannot move from OPEN to SERVED: only DRINK items may skip ahead, and this item is FOOD. Permitted from OPEN: IN_PROGRESS',
    );
  });

  it('02 gives no DRINK hint when the product type is not the reason', async () => {
    const items = await service({ repository: { findByOrderAndId: finding(item('SERVED')) } });
    const move = items.update(1, 4, { status: 'OPEN' });

    await expect(move).rejects.toBeInstanceOf(ConflictException);
    await expect(move).rejects.toThrow(/cannot move from SERVED to OPEN\. Permitted from SERVED: READY, REMAKE$/);
  });

  it('03 accepts the current status without writing anything', async () => {
    const updateWhenStatusIs = vi.fn();
    const itemStatusChanged = vi.fn();
    const items = await service({
      repository: { findByOrderAndId: finding(item('READY')), updateWhenStatusIs },
      events: { itemStatusChanged },
    });

    await expect(items.update(1, 4, { status: 'READY' })).resolves.toMatchObject({ status: 'READY' });
    expect(updateWhenStatusIs).not.toHaveBeenCalled();
    expect(itemStatusChanged).not.toHaveBeenCalled();
  });

  it('04 reports a lost race on the status with 409', async () => {
    const items = await service({
      repository: {
        findByOrderAndId: finding(item('OPEN')),
        updateWhenStatusIs: vi.fn().mockResolvedValue(null),
      },
    });
    const move = items.update(1, 4, { status: 'IN_PROGRESS' });

    await expect(move).rejects.toBeInstanceOf(ConflictException);
    await expect(move).rejects.toThrow('changed by another request');
  });

  it('05 writes only while the item still has the status it was checked against, and records the move', async () => {
    const updated = item('IN_PROGRESS');
    const updateWhenStatusIs = vi.fn().mockResolvedValue(updated);
    const itemStatusChanged = vi.fn();
    const items = await service({
      repository: { findByOrderAndId: finding(item('OPEN')), updateWhenStatusIs },
      events: { itemStatusChanged },
    });

    await expect(items.update(1, 4, { status: 'IN_PROGRESS' })).resolves.toBe(updated);

    expect(updateWhenStatusIs).toHaveBeenCalledWith(4, 'OPEN', { status: 'IN_PROGRESS' });
    expect(itemStatusChanged).toHaveBeenCalledWith(updated, 'OPEN');
  });

  it('06 answers 404 for an item that is not on the order', async () => {
    const items = await service({ repository: { findByOrderAndId: finding(null) } });

    await expect(items.update(1, 4, { status: 'OPEN' })).rejects.toThrow(NotFoundException);
  });

  it('08 moves items without an ownership check', async () => {
    const forChange = vi.fn().mockResolvedValue({});
    const items = await service({
      orderLock: { forChange },
      repository: { findByOrderAndId: finding(item('OPEN')) },
    });

    await items.update(1, 4, { status: 'OPEN' });

    expect(forChange).toHaveBeenCalledWith(1);
  });
});

describe('U-SV-ITM adding and removing items', () => {
  it('07 maps an unknown product to 400', async () => {
    const items = await service({ repository: { create: vi.fn().mockRejectedValue(prismaError('P2003')) } });
    const add = items.create(1, { productId: 9 });

    await expect(add).rejects.toBeInstanceOf(BadRequestException);
    await expect(add).rejects.toThrow('Product 9 does not exist');
  });

  it("09 locks the order with the guest's party, then adds and records the item", async () => {
    const created = item('OPEN');
    const forChange = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue(created);
    const itemCreated = vi.fn();
    const items = await service({ orderLock: { forChange }, repository: { create }, events: { itemCreated } });

    await expect(items.create(1, { productId: 1 }, { tableSessionId: 2 })).resolves.toBe(created);

    expect(forChange).toHaveBeenCalledWith(1, { tableSessionId: 2 });
    expect(create).toHaveBeenCalledWith(1, { productId: 1 });
    expect(itemCreated).toHaveBeenCalledWith(created);
  });

  it('10 adds nothing when the order may not be changed', async () => {
    const create = vi.fn();
    const items = await service({
      orderLock: { forChange: vi.fn().mockRejectedValue(new ConflictException('closed')) },
      repository: { create },
    });

    await expect(items.create(1, { productId: 1 })).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('11 removes an item of the order and records it', async () => {
    const removed = item('OPEN');
    const remove = vi.fn().mockResolvedValue(removed);
    const itemDeleted = vi.fn();
    const items = await service({
      repository: { findByOrderAndId: finding(item('OPEN')), remove },
      events: { itemDeleted },
    });

    await expect(items.remove(1, 4)).resolves.toBe(removed);
    expect(remove).toHaveBeenCalledWith(4);
    expect(itemDeleted).toHaveBeenCalledWith(removed);
  });

  it('12 answers 404 when removing an item that is not on the order', async () => {
    const remove = vi.fn();
    const items = await service({ repository: { findByOrderAndId: finding(null), remove } });

    await expect(items.remove(1, 4)).rejects.toThrow(NotFoundException);
    expect(remove).not.toHaveBeenCalled();
  });
});
