import { NotFoundException } from '@nestjs/common';
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

describe('U-SV-ITM OrderItemsService', () => {
  it('01 names the permitted moves and why a skip is refused', async () => {
    const items = await service({ repository: { findByOrderAndId: finding(item('OPEN')) } });

    await expect(items.update(1, 4, { status: 'SERVED' })).rejects.toThrow(
      'cannot move from OPEN to SERVED: only DRINK items may skip ahead, and this item is FOOD. Permitted from OPEN: IN_PROGRESS',
    );
  });

  it('02 gives no DRINK hint when the product type is not the reason', async () => {
    const items = await service({ repository: { findByOrderAndId: finding(item('SERVED')) } });

    await expect(items.update(1, 4, { status: 'OPEN' })).rejects.toThrow(
      /cannot move from SERVED to OPEN\. Permitted from SERVED: READY, REMAKE$/,
    );
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

  it('04 reports a lost race on the status to the caller', async () => {
    const items = await service({
      repository: {
        findByOrderAndId: finding(item('OPEN')),
        updateWhenStatusIs: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(items.update(1, 4, { status: 'IN_PROGRESS' })).rejects.toThrow(
      'changed by another request',
    );
  });

  it('05 records the move with the previous status', async () => {
    const updated = item('IN_PROGRESS');
    const itemStatusChanged = vi.fn();
    const items = await service({
      repository: {
        findByOrderAndId: finding(item('OPEN')),
        updateWhenStatusIs: vi.fn().mockResolvedValue(updated),
      },
      events: { itemStatusChanged },
    });

    await items.update(1, 4, { status: 'IN_PROGRESS' });

    expect(itemStatusChanged).toHaveBeenCalledWith(updated, 'OPEN');
  });

  it('06 answers 404 for an item that is not on the order', async () => {
    const items = await service({ repository: { findByOrderAndId: finding(null) } });

    await expect(items.update(1, 4, { status: 'OPEN' })).rejects.toThrow(NotFoundException);
  });

  it('07 maps an unknown product to 400', async () => {
    const items = await service({ repository: { create: vi.fn().mockRejectedValue(prismaError('P2003')) } });

    await expect(items.create(1, { productId: 9 })).rejects.toThrow('Product 9 does not exist');
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
