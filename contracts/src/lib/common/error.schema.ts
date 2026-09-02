import { z } from 'zod';

/**
 * The body Nest's exception layer returns for every 4xx/5xx response.
 * `message` is an array of `"<field>: <problem>"` strings when a request fails
 * schema validation, and a single string for errors raised by a service.
 */
export const errorResponseSchema = z
  .object({
    statusCode: z.number().int().meta({
      description: 'HTTP status code, repeated in the body.',
      example: 400,
    }),

    error: z.string().meta({
      description: 'Reason phrase for the status code.',
      example: 'Bad Request',
    }),

    message: z.union([z.string(), z.array(z.string())]).meta({
      description:
        'One message for errors raised by a service, or one entry per failed field for schema validation errors.',
      example: ['price: Too small: expected number to be >=0'],
    }),
  })
  .meta({
    id: 'ErrorResponse',
    title: 'Error response',
    description: 'Standard error envelope used by every endpoint.',
  });

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
