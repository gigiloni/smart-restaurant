import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { prismaError, stub } from '../../test/support/unit.js';
import type { IngredientsRepository } from './ingredients.repository.js';
import { IngredientsService } from './ingredients.service.js';

const service = (repository: object) => new IngredientsService(stub<IngredientsRepository>(repository));

describe('U-SV-ING IngredientsService', () => {
  it('01 maps an ingredient used in a recipe on delete to 409', async () => {
    const ingredients = service({
      findById: vi.fn().mockResolvedValue({ id: 1 }),
      remove: vi.fn().mockRejectedValue(prismaError('P2003')),
    });
    const removing = ingredients.remove(1);

    await expect(removing).rejects.toBeInstanceOf(ConflictException);
    await expect(removing).rejects.toThrow('still used by at least one product');
  });

  it('02 answers 404 for an unknown ingredient, and does not attempt a write', async () => {
    const update = vi.fn();
    const remove = vi.fn();
    const ingredients = service({ findById: vi.fn().mockResolvedValue(null), update, remove });

    await expect(ingredients.update(1, { name: 'Salt' })).rejects.toThrow(NotFoundException);
    await expect(ingredients.remove(1)).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
