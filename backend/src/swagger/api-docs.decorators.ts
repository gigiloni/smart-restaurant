import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';

import { errorResponseSchema } from '@smart-restaurant/contracts';

/**
 * Documents an id path parameter. Only the prose is supplied here: the schema
 * itself is derived from the `idParamSchema` on the `@Param` decorator, so the
 * two can never drift apart.
 */
export const ApiIdParam = (name: string, description: string) =>
  ApiParam({
    name,
    description,
    required: true,
  });

/**
 * Raised by the global validation pipe when the body or a path parameter does
 * not match its schema.
 */
export const ApiValidationErrorResponse = (description: string) =>
  ApiBadRequestResponse({
    description,
    standardSchema: errorResponseSchema,
  });

export const ApiEntityNotFoundResponse = (description: string) =>
  ApiNotFoundResponse({
    description,
    standardSchema: errorResponseSchema,
  });

export const ApiEntityConflictResponse = (description: string) =>
  ApiConflictResponse({
    description,
    standardSchema: errorResponseSchema,
  });
