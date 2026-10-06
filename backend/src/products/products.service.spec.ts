import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { CreateProductDto } from '@smart-restaurant/contracts';

import { prismaError, stub } from '../../test/support/unit.js';
import type { ProductsRepository } from './products.repository.js';
import { ProductsService } from './products.service.js';

const products = (repository: object) => new ProductsService(stub<ProductsRepository>(repository));

describe('U-SV-PRD ProductsService', () => {
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

  it('04 answers 404 for an unknown product, and does not attempt an update', async () => {
    const update = vi.fn();
    const service = products({ findById: vi.fn().mockResolvedValue(null), update });

    await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    await expect(service.update(1, { price: 2 })).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });
});
