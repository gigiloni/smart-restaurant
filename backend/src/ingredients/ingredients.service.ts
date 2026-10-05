import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { CreateIngredientDto, UpdateIngredientDto } from '@smart-restaurant/contracts';

import { PrismaErrorCode, isPrismaError } from '../database/prisma-error.js';
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import type { PrismaAdapter } from '../database/transaction.js';
import { OrderEventsWriter } from '../order-events/order-events.writer.js';

@Injectable()
export class IngredientsService {
  constructor(
    private readonly host: TransactionHost<PrismaAdapter>,
    private readonly events: OrderEventsWriter,
  ) {}
  private get db() {
    return this.host.tx;
  }

  findAll() {
    return this.db.ingredient.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: number) {
    const ingredient = await this.db.ingredient.findUnique({ where: { id } });

    if (!ingredient) {
      throw new NotFoundException(`Ingredient ${id} not found`);
    }

    return ingredient;
  }

  @Transactional()
  async create(dto: CreateIngredientDto) {
    const ingredient = await this.db.ingredient.create({ data: dto });
    await this.events.inventoryUpdated(ingredient.id, { ...ingredient, unit: dto.unit });
    return ingredient;
  }

  @Transactional()
  async update(id: number, dto: UpdateIngredientDto) {
    await this.db
      .$queryRaw`SELECT ingredient_id FROM "Ingredient" WHERE ingredient_id = ${id} FOR UPDATE`;
    const current = await this.findOne(id);
    const { expectedStock, ...changes } = dto;
    if (dto.stock !== undefined && expectedStock !== undefined && expectedStock !== current.stock)
      throw new ConflictException(
        'Bestand wurde inzwischen geändert. Live-Bestand übernehmen und erneut speichern.',
      );
    if (dto.unit && dto.unit !== current.unit) {
      const used = await this.db.stockBooking.count({ where: { ingredientId: id } });
      if (used || current.stock !== 0)
        throw new ConflictException(
          'Einheit einer Zutat mit Bestand oder Bestandsbuchungen kann nicht geändert werden. Neue Zutat mit der gewünschten Einheit anlegen.',
        );
    }
    const ingredient = await this.db.ingredient.update({ where: { id }, data: changes });
    await this.events.inventoryUpdated(id, {
      ...ingredient,
      unit: ingredient.unit as 'g' | 'ml' | 'Stück',
    });
    return ingredient;
  }

  @Transactional()
  async remove(id: number) {
    await this.findOne(id);

    try {
      const ingredient = await this.db.ingredient.delete({ where: { id } });
      await this.events.inventoryUpdated(id, null);
      return ingredient;
    } catch (error) {
      // Recipes reference ingredients; those references are not cascaded away.
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyConstraintViolation)) {
        throw new ConflictException(
          `Zutat ${id} wird in einem Rezept oder einer Bestandsbuchung verwendet.`,
        );
      }

      throw error;
    }
  }
}
