import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { CreateProductDto } from '@smart-restaurant/contracts';

import { prismaError, stub } from '../../test/support/unit.js';
import type { IngredientsRepository } from '../ingredients/ingredients.repository.js';
import { IngredientsService } from '../ingredients/ingredients.service.js';
import type { ProductsRepository } from './products.repository.js';
import { ProductsService } from './products.service.js';

const products = (repository: object) => new ProductsService(stub<ProductsRepository>(repository));

describe('U-SV-PRD ProductsService and IngredientsService', () => {
  it.each(['P2003', 'P2025'])('01 maps an unknown ingredient (%s) to 400', async (code) => {
    const service = products({ create: vi.fn().mockRejectedValue(prismaError(code)) });

    await expect(service.create(stub<CreateProductDto>())).rejects.toThrow(BadRequestException);
  });

  it('02 maps an ordered product on delete to 409', async () => {
    const service = products({
      findById: vi.fn().mockResolvedValue({ id: 1 }),
      remove: vi.fn().mockRejectedValue(prismaError('P2003')),
    });

    await expect(service.remove(1)).rejects.toThrow(ConflictException);
  });

  it('03 passes the requested ids to the repository', async () => {
    const findAll = vi.fn().mockResolvedValue([]);

    await products({ findAll }).findAll([2, 1]);

    expect(findAll).toHaveBeenCalledWith([2, 1]);
  });

  it('04 maps an ingredient used in a recipe on delete to 409', async () => {
    const service = new IngredientsService(
      stub<IngredientsRepository>({
        findById: vi.fn().mockResolvedValue({ id: 1 }),
        remove: vi.fn().mockRejectedValue(prismaError('P2003')),
      }),
    );

    await expect(service.remove(1)).rejects.toThrow('still used by at least one product');
  });
});
