import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { CreateProductDto, UpdateProductDto } from '@smart-restaurant/contracts';

import { PrismaErrorCode, isPrismaError } from '../database/prisma-error.js';
import { ProductsRepository, type ProductWithDetails } from './products.repository.js';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  findAll(): Promise<ProductWithDetails[]> {
    return this.productsRepository.findAll();
  }

  async findOne(id: number): Promise<ProductWithDetails> {
    const product = await this.productsRepository.findById(id);

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  async create(dto: CreateProductDto): Promise<ProductWithDetails> {
    try {
      return await this.productsRepository.create(dto);
    } catch (error) {
      throw this.mapUnknownIngredient(error);
    }
  }

  async update(id: number, dto: UpdateProductDto): Promise<ProductWithDetails> {
    await this.findOne(id);

    try {
      return await this.productsRepository.update(id, dto);
    } catch (error) {
      throw this.mapUnknownIngredient(error);
    }
  }

  async remove(id: number): Promise<ProductWithDetails> {
    await this.findOne(id);

    try {
      return await this.productsRepository.remove(id);
    } catch (error) {
      // The recipe cascades away with the product, but order items do not:
      // a product that has been ordered stays on the menu.
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyConstraintViolation)) {
        throw new ConflictException(`Product ${id} is still referenced by at least one order item`);
      }

      throw error;
    }
  }

  /**
   * A recipe line pointing at a missing ingredient is a bad request, not a
   * missing product.
   */
  private mapUnknownIngredient(error: unknown): unknown {
    if (
      isPrismaError(error, PrismaErrorCode.ForeignKeyConstraintViolation) ||
      isPrismaError(error, PrismaErrorCode.RecordNotFound)
    ) {
      return new BadRequestException('One or more ingredients do not exist');
    }

    return error;
  }
}
