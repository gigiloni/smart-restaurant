import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { prismaError, stub } from '../../test/support/unit.js';
import type { TablesRepository } from './tables.repository.js';
import { TablesService } from './tables.service.js';

const service = (repository: object) => new TablesService(stub<TablesRepository>(repository));

describe('U-SV-TBL TablesService', () => {
  it('01 answers 404 for an unknown table', async () => {
    await expect(service({ findById: vi.fn().mockResolvedValue(null) }).findOne(1)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('02 maps a duplicate table number to 409', async () => {
    const tables = service({ create: vi.fn().mockRejectedValue(prismaError('P2002')) });

    await expect(tables.create({ tableNumber: 3, seats: 0 })).rejects.toThrow(
      'Table number 3 is already taken',
    );
  });

  it('03 does not attempt to update an unknown table', async () => {
    const update = vi.fn();
    const tables = service({ findById: vi.fn().mockResolvedValue(null), update });

    await expect(tables.update(1, { seats: 1 })).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('04 maps a referenced table on delete to 409', async () => {
    const tables = service({
      findById: vi.fn().mockResolvedValue({ id: 1 }),
      remove: vi.fn().mockRejectedValue(prismaError('P2003')),
    });

    await expect(tables.remove(1)).rejects.toThrow(ConflictException);
  });

  it('05 rethrows anything else unchanged', async () => {
    const failure = new Error('database down');
    const tables = service({ create: vi.fn().mockRejectedValue(failure) });

    await expect(tables.create({ tableNumber: 1, seats: 0 })).rejects.toBe(failure);
  });
});
