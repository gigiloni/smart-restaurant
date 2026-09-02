import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import {
  createProductSchema,
  idParamSchema,
  updateProductSchema,
  type CreateProductDto,
  type UpdateProductDto,
} from '@smart-restaurant/contracts';

import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', { schema: idParamSchema }) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body({ schema: createProductSchema }) dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateProductSchema }) dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', { schema: idParamSchema }) id: number) {
    return this.productsService.remove(id);
  }
}
