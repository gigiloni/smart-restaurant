import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import {
  createIngredientSchema,
  idParamSchema,
  updateIngredientSchema,
  type CreateIngredientDto,
  type UpdateIngredientDto,
} from '@smart-restaurant/contracts';

import { IngredientsService } from './ingredients.service.js';

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  findAll() {
    return this.ingredientsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', { schema: idParamSchema }) id: number) {
    return this.ingredientsService.findOne(id);
  }

  @Post()
  create(@Body({ schema: createIngredientSchema }) dto: CreateIngredientDto) {
    return this.ingredientsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateIngredientSchema }) dto: UpdateIngredientDto,
  ) {
    return this.ingredientsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', { schema: idParamSchema }) id: number) {
    return this.ingredientsService.remove(id);
  }
}
