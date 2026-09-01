import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { z } from 'zod';

import {
  createTableSchema,
  updateTableSchema,
  type CreateTableDto,
  type UpdateTableDto,
} from '@smart-restaurant/contracts';

import { TablesService } from './tables.service.js';

const idSchema = z.coerce
  .number()
  .int()
  .positive();

@Controller('tables')
export class TablesController {
  constructor(
    private readonly tablesService: TablesService,
  ) {}

  @Get()
  findAll() {
    return this.tablesService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id', {
      schema: idSchema,
    })
    id: number,
  ) {
    return this.tablesService.findOne(id);
  }

  @Post()
  create(
    @Body({
      schema: createTableSchema,
    })
    dto: CreateTableDto,
  ) {
    return this.tablesService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', {
      schema: idSchema,
    })
    id: number,

    @Body({
      schema: updateTableSchema,
    })
    dto: UpdateTableDto,
  ) {
    return this.tablesService.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', {
      schema: idSchema,
    })
    id: number,
  ) {
    return this.tablesService.remove(id);
  }
}
