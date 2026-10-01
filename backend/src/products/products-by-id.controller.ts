import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  MAX_PRODUCT_IDS,
  productSchema,
  productsByIdSchema,
  type ProductsByIdDto,
} from '@smart-restaurant/contracts';

import { ApiValidationErrorResponse } from '../swagger/api-docs.decorators.js';
import { ProductsService } from './products.service.js';

/**
 * A read sent as POST, for clients that would rather put the ids in a JSON
 * body than in the query string. It lives on its own path because
 * `POST /products` already creates a product.
 */
@ApiTags('Products')
@Controller('products-by-id')
export class ProductsByIdController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Look up products by id',
    description:
      'Returns the products whose ids are in the body, sorted by name, each with its recipe resolved: for example the products of a cart or an order.\n\n' +
      'The same lookup as `GET /products?ids=3,1,7`, with the ids sent as JSON instead. Nothing is created or changed, so it answers 200 and is safe to repeat.\n\n' +
      'Ids that match no product are left out rather than failing the request, so compare the result with what you asked for. Duplicates are ignored.\n\n' +
      'Guests seated through a QR code can use it too, like the menu.',
  })
  @ApiOkResponse({
    description: 'The products found, sorted by name.',
    standardSchema: productSchema,
    isArray: true,
  })
  @ApiValidationErrorResponse(
    `\`ids\` is missing or empty, holds something other than positive integers, or lists more than ${MAX_PRODUCT_IDS} ids.`,
  )
  findByIds(@Body({ schema: productsByIdSchema }) dto: ProductsByIdDto) {
    return this.productsService.findAll(dto.ids);
  }
}
