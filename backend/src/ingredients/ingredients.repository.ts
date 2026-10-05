import { Injectable } from '@nestjs/common';

import type { CreateIngredientDto, UpdateIngredientDto } from '@smart-restaurant/contracts';

import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class IngredientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.ingredient.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  findById(id: number) {
    return this.prisma.ingredient.findUnique({
      where: {
        id,
      },
    });
  }

  create(dto: CreateIngredientDto) {
    return this.prisma.ingredient.create({
      data: dto,
    });
  }

  update(id: number, dto: UpdateIngredientDto) {
    const { name, unit, stock } = dto;
    return this.prisma.ingredient.update({
      where: {
        id,
      },

      data: { name, unit, stock },
    });
  }

  remove(id: number) {
    return this.prisma.ingredient.delete({
      where: {
        id,
      },
    });
  }
}
