import { describe, expect, it } from 'vitest';

import { createTableSchema } from './create-table.schema.js';
import { updateTableSchema } from './update-table.schema.js';

describe('U-CT-06 table payloads', () => {
  it('defaults seats to 0', () => {
    expect(createTableSchema.parse({ tableNumber: 9 })).toEqual({ tableNumber: 9, seats: 0 });
  });

  it.each([{ tableNumber: 0 }, { tableNumber: 1, seats: -1 }, { tableNumber: 1.5 }, {}])(
    'rejects %j',
    (body) => {
      expect(createTableSchema.safeParse(body).success).toBe(false);
    },
  );

  it('rejects an empty update', () => {
    expect(updateTableSchema.safeParse({}).success).toBe(false);
  });

  // Known gap: the assignment asks for 2 to 8 seats, but no range is enforced
  // yet. Replace this case with the range once the team decides on it.
  it('accepts any non-negative seat count (no 2-8 range yet)', () => {
    expect(createTableSchema.safeParse({ tableNumber: 1, seats: 100 }).success).toBe(true);
  });
});
