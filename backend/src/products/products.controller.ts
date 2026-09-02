import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  createProductSchema,
  idParamSchema,
  productSchema,
  updateProductSchema,
  type CreateProductDto,
  type UpdateProductDto,
} from '@smart-restaurant/contracts';

import {
  ApiEntityConflictResponse,
  ApiEntityNotFoundResponse,
  ApiIdParam,
  ApiValidationErrorResponse,
} from '../swagger/api-docs.decorators.js';
import { ProductsService } from './products.service.js';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all products',
    description:
      'Returns every product on the menu, sorted by name, each with its recipe resolved. Takes no query parameters: the list is neither filtered nor paginated.',
  })
  @ApiOkResponse({
    description: 'All products, sorted by name.',
    standardSchema: productSchema,
    isArray: true,
  })
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one product',
    description: 'Returns a single product with its recipe resolved.',
  })
  @ApiIdParam('id', 'Id of the product to return.')
  @ApiOkResponse({ description: 'The requested product.', standardSchema: productSchema })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No product with that id exists.')
  findOne(@Param('id', { schema: idParamSchema }) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a product',
    description:
      'Creates a product and, when `ingredients` is supplied, its recipe in the same request.\n\n' +
      '**Side effects:** each entry in `ingredients` writes one `Product_Ingredient` row. The write is atomic — if any referenced ingredient does not exist the whole request fails and no product is created.',
  })
  @ApiCreatedResponse({
    description: 'The created product, with its recipe resolved.',
    standardSchema: productSchema,
  })
  @ApiValidationErrorResponse(
    'The payload failed validation, an ingredient appears more than once, or a referenced ingredient does not exist.',
  )
  create(@Body({ schema: createProductSchema }) dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a product',
    description:
      'Updates the fields present in the payload. At least one field is required.\n\n' +
      '**Side effects:** sending `ingredients` REPLACES the whole recipe — every existing `Product_Ingredient` row for this product is deleted and the supplied lines are written in their place, so any line missing from the array is removed. Omit `ingredients` entirely to leave the recipe untouched.',
  })
  @ApiIdParam('id', 'Id of the product to update.')
  @ApiOkResponse({
    description: 'The updated product, with its recipe resolved.',
    standardSchema: productSchema,
  })
  @ApiValidationErrorResponse(
    '`id` is not a positive integer, the payload is empty or invalid, an ingredient appears more than once, or a referenced ingredient does not exist.',
  )
  @ApiEntityNotFoundResponse('No product with that id exists.')
  update(
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateProductSchema }) dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a product',
    description:
      'Removes a product from the menu.\n\n' +
      '**Side effects:** the recipe is cascaded away — every `Product_Ingredient` row for this product is deleted with it. The ingredients themselves are not touched.\n\n' +
      'A product that appears on an order is not deletable, so order history keeps pointing at a real product.',
  })
  @ApiIdParam('id', 'Id of the product to delete.')
  @ApiOkResponse({
    description: 'The deleted product, as it was immediately before deletion.',
    standardSchema: productSchema,
  })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No product with that id exists.')
  @ApiEntityConflictResponse('The product is still referenced by at least one order item.')
  remove(@Param('id', { schema: idParamSchema }) id: number) {
    return this.productsService.remove(id);
  }
}
