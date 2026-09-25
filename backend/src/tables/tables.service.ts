import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  CreateTableDto,
  UpdateTableDto,
} from '@smart-restaurant/contracts';

import { PrismaErrorCode, isPrismaError } from '../database/prisma-error.js';
import { TablesRepository } from './tables.repository.js';

@Injectable()
export class TablesService {
  constructor(
    private readonly tablesRepository: TablesRepository,
  ) {}

  findAll() {
    return this.tablesRepository.findAll();
  }

  async findOne(id: number) {
    const table =
      await this.tablesRepository.findById(id);

    if (!table) {
      throw new NotFoundException(
        `Table ${id} not found`,
      );
    }

    return table;
  }

  async create(dto: CreateTableDto) {
    try {
      return await this.tablesRepository.create(dto);
    } catch (error) {
      throw this.mapDuplicateTableNumber(error, dto.tableNumber);
    }
  }

  async update(
    id: number,
    dto: UpdateTableDto,
  ) {
    await this.findOne(id);

    try {
      return await this.tablesRepository.update(
        id,
        dto,
      );
    } catch (error) {
      throw this.mapDuplicateTableNumber(
        error,
        dto.tableNumber,
      );
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      return await this.tablesRepository.remove(id);
    } catch (error) {
      // Sessions and orders reference their table; neither is cascaded away,
      // so a table that has ever seated a party stays on the books.
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyConstraintViolation)) {
        throw new ConflictException(
          `Table ${id} has seated at least one party`,
        );
      }

      throw error;
    }
  }

  /**
   * `table_number` is unique, so reusing one is a conflict with an existing
   * table rather than a malformed request.
   */
  private mapDuplicateTableNumber(
    error: unknown,
    tableNumber: number | undefined,
  ): unknown {
    if (isPrismaError(error, PrismaErrorCode.UniqueConstraintViolation)) {
      return new ConflictException(
        `Table number ${tableNumber} is already taken`,
      );
    }

    return error;
  }
}
