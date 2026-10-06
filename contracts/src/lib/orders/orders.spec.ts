import { describe, expect, it } from 'vitest';

import { liveEventsQuerySchema } from '../live/live.schema.js';
import { createOrderItemSchema } from '../order-items/create-order-item.schema.js';
import { updateOrderItemSchema } from '../order-items/update-order-item.schema.js';
import { enterAsGuestSchema } from '../viewer/viewer.schema.js';
import { createOrderSchema } from './create-order.schema.js';
import { updateOrderSchema } from './update-order.schema.js';

describe('U-CT-09 orders, items, guests and the live stream', () => {
  it('makes employeeId optional and nullable on create', () => {
    expect(createOrderSchema.parse({ tableId: 1 })).toEqual({ tableId: 1 });
    expect(createOrderSchema.safeParse({ tableId: 1, employeeId: null }).success).toBe(true);
  });

  // Guests must send at least one item; that rule lives in the service.
  it('accepts an empty items array', () => {
    expect(createOrderSchema.safeParse({ tableId: 1, items: [] }).success).toBe(true);
  });

  it('requires tableId', () => {
    expect(createOrderSchema.safeParse({}).success).toBe(false);
  });

  it('requires the employeeId key on update', () => {
    expect(updateOrderSchema.safeParse({}).success).toBe(false);
  });

  it('drops a status sent with a new item, so items always start OPEN', () => {
    expect(createOrderItemSchema.parse({ productId: 1, status: 'SERVED' })).toEqual({ productId: 1 });
  });

  it('rejects an unknown item status', () => {
    expect(updateOrderItemSchema.safeParse({ status: 'PAID' }).success).toBe(false);
  });

  it('bounds the QR token to 1-200 characters', () => {
    expect(enterAsGuestSchema.safeParse({ tableId: 1, token: '' }).success).toBe(false);
    expect(enterAsGuestSchema.safeParse({ tableId: 1, token: 'x'.repeat(201) }).success).toBe(false);
  });

  it('coerces since and rejects negatives', () => {
    expect(liveEventsQuerySchema.parse({ since: '5' })).toEqual({ since: 5 });
    expect(liveEventsQuerySchema.safeParse({ since: '-1' }).success).toBe(false);
  });
});
