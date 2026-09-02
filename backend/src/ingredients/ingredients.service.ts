import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { CreateIngredientDto, UpdateIngredientDto } from '@smart-restaurant/contracts';

import { PrismaErrorCode, isPrismaError } from '../database/prisma-error.js';
import { IngredientsRepository } from './ingredients.repository.js';

@Injectable()
export class IngredientsService {
  constructor(private readonly ingredientsRepository: IngredientsRepository) {}

  findAll() {
    return this.ingredientsRepository.findAll();
  }

  async findOne(id: number) {
    const ingredient = await this.ingredientsRepository.findById(id);

    if (!ingredient) {
      throw new NotFoundException(`Ingredient ${id} not found`);
    }

    return ingredient;
  }

  create(dto: CreateIngredientDto) {
    return this.ingredientsRepository.create(dto);
  }

  async update(id: number, dto: UpdateIngredientDto) {
    await this.findOne(id);

    return this.ingredientsRepository.update(id, dto);
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      return await this.ingredientsRepository.remove(id);
    } catch (error) {
      // Recipes reference ingredients; those references are not cascaded away.
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyConstraintViolation)) {
        throw new ConflictException(`Ingredient ${id} is still used by at least one product`);
      }

      throw error;
    }
  }
}
