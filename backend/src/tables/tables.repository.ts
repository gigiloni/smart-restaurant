import { Injectable } from '@nestjs/common';

import type {
  CreateTableDto,
  UpdateTableDto,
} from '@smart-restaurant/contracts';

import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class TablesRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  findAll() {
    return this.prisma.restaurantTable.findMany({
      orderBy: {
        tableNumber: 'asc',
      },
    });
  }

  findById(id: number) {
    return this.prisma.restaurantTable.findUnique({
      where: {
        id,
      },
    });
  }

  create(dto: CreateTableDto) {
    return this.prisma.restaurantTable.create({
      data: dto,
    });
  }

  update(
    id: number,
    dto: UpdateTableDto,
  ) {
    return this.prisma.restaurantTable.update({
      where: {
        id,
      },

      data: dto,
    });
  }

  remove(id: number) {
    return this.prisma.restaurantTable.delete({
      where: {
        id,
      },
    });
  }
}
