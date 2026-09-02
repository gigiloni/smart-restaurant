import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  createIngredientSchema,
  idParamSchema,
  ingredientSchema,
  updateIngredientSchema,
  type CreateIngredientDto,
  type UpdateIngredientDto,
} from '@smart-restaurant/contracts';

import {
  ApiEntityConflictResponse,
  ApiEntityNotFoundResponse,
  ApiIdParam,
  ApiValidationErrorResponse,
} from '../swagger/api-docs.decorators.js';
import { IngredientsService } from './ingredients.service.js';

@ApiTags('Ingredients')
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all ingredients',
    description:
      'Returns every ingredient, sorted by name. Takes no query parameters: the list is neither filtered nor paginated.',
  })
  @ApiOkResponse({
    description: 'All ingredients, sorted by name.',
    standardSchema: ingredientSchema,
    isArray: true,
  })
  findAll() {
    return this.ingredientsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one ingredient', description: 'Returns a single ingredient.' })
  @ApiIdParam('id', 'Id of the ingredient to return.')
  @ApiOkResponse({ description: 'The requested ingredient.', standardSchema: ingredientSchema })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No ingredient with that id exists.')
  findOne(@Param('id', { schema: idParamSchema }) id: number) {
    return this.ingredientsService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create an ingredient',
    description:
      'Creates an ingredient that products can then reference in their recipes. Names are not required to be unique.',
  })
  @ApiCreatedResponse({
    description: 'The created ingredient.',
    standardSchema: ingredientSchema,
  })
  @ApiValidationErrorResponse('The payload failed validation.')
  create(@Body({ schema: createIngredientSchema }) dto: CreateIngredientDto) {
    return this.ingredientsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Rename an ingredient',
    description:
      'Updates the fields present in the payload. At least one field is required.\n\n' +
      '**Side effects:** the new name is visible through every product recipe that references this ingredient, since recipes hold a reference rather than a copy.',
  })
  @ApiIdParam('id', 'Id of the ingredient to update.')
  @ApiOkResponse({ description: 'The updated ingredient.', standardSchema: ingredientSchema })
  @ApiValidationErrorResponse('`id` is not a positive integer, or the payload is empty or invalid.')
  @ApiEntityNotFoundResponse('No ingredient with that id exists.')
  update(
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateIngredientSchema }) dto: UpdateIngredientDto,
  ) {
    return this.ingredientsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an ingredient',
    description:
      'Removes an ingredient.\n\n' +
      'An ingredient used by any product recipe is not deletable — recipes reference ingredients rather than owning them, so nothing is cascaded away here. Remove the ingredient from the recipes that use it first.',
  })
  @ApiIdParam('id', 'Id of the ingredient to delete.')
  @ApiOkResponse({
    description: 'The deleted ingredient, as it was immediately before deletion.',
    standardSchema: ingredientSchema,
  })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No ingredient with that id exists.')
  @ApiEntityConflictResponse('The ingredient is still used by at least one product recipe.')
  remove(@Param('id', { schema: idParamSchema }) id: number) {
    return this.ingredientsService.remove(id);
  }
}
