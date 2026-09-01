import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  CreateTableDto,
  UpdateTableDto,
} from '@smart-restaurant/contracts';

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

  create(dto: CreateTableDto) {
    return this.tablesRepository.create(dto);
  }

  async update(
    id: number,
    dto: UpdateTableDto,
  ) {
    await this.findOne(id);

    return this.tablesRepository.update(
      id,
      dto,
    );
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.tablesRepository.remove(id);
  }
}
