import { Injectable } from '@nestjs/common';

import type {
  CreateProductDto,
  ProductIngredientDto,
  UpdateProductDto,
} from '@smart-restaurant/contracts';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

const productDetailsInclude = {
  ingredients: {
    include: {
      ingredient: true,
    },
  },
} satisfies Prisma.ProductInclude;

export type ProductWithDetails = Prisma.ProductGetPayload<{
  include: typeof productDetailsInclude;
}>;

/**
 * `Product_Ingredient` rows are never written on their own: they are always
 * created as part of the product that owns them.
 */
const toRecipeRows = (
  ingredients: ProductIngredientDto[],
): Prisma.ProductIngredientCreateWithoutProductInput[] =>
  ingredients.map(({ ingredientId, amount }) => ({
    amount,

    ingredient: {
      connect: {
        id: ingredientId,
      },
    },
  }));

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<ProductWithDetails[]> {
    return this.prisma.product.findMany({
      include: productDetailsInclude,

      orderBy: {
        name: 'asc',
      },
    });
  }

  findById(id: number): Promise<ProductWithDetails | null> {
    return this.prisma.product.findUnique({
      where: {
        id,
      },

      include: productDetailsInclude,
    });
  }

  create({ ingredients, ...product }: CreateProductDto): Promise<ProductWithDetails> {
    return this.prisma.product.create({
      data: {
        ...product,

        ingredients: ingredients && {
          create: toRecipeRows(ingredients),
        },
      },

      include: productDetailsInclude,
    });
  }

  /**
   * Passing `ingredients` replaces the recipe wholesale; omitting it leaves the
   * existing recipe untouched.
   */
  update(
    id: number,
    { ingredients, ...product }: UpdateProductDto,
  ): Promise<ProductWithDetails> {
    return this.prisma.product.update({
      where: {
        id,
      },

      data: {
        ...product,

        ingredients: ingredients && {
          deleteMany: {},
          create: toRecipeRows(ingredients),
        },
      },

      include: productDetailsInclude,
    });
  }

  remove(id: number): Promise<ProductWithDetails> {
    return this.prisma.product.delete({
      where: {
        id,
      },

      include: productDetailsInclude,
    });
  }
}
