import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type SwaggerDocumentOptions } from '@nestjs/swagger';
import { createSchema } from 'zod-openapi';

/**
 * Conventions that hold for every endpoint, documented once here rather than
 * repeated on each route.
 */
const API_DESCRIPTION = [
  'REST API for the Smart Restaurant project.',
  '',
  '### Conventions',
  '',
  '- Every route is served under the `/api` prefix.',
  '- Request bodies and path parameters are validated against the Zod schemas in the shared',
  '  `@smart-restaurant/contracts` library, so the frontend and the backend agree on one definition.',
  '- Ids are auto-incrementing integers. Path parameters arrive as strings and are coerced, so',
  '  `/products/1` and `/products/01` address the same product, while `/products/abc` fails with 400.',
  '- No endpoint takes query parameters. Collections are returned whole: they are neither filtered',
  '  nor paginated.',
  '- `PATCH` is a partial update. Every field is optional, but an empty object is rejected with 400',
  '  rather than treated as a no-op.',
  '- Write endpoints return the row they wrote, and `DELETE` returns the row as it was immediately',
  '  before deletion.',
  '- Errors share one envelope: `{ statusCode, error, message }`. `message` is an array of',
  '  `"<field>: <problem>"` strings for schema validation failures and a single string otherwise.',
  '- Money is returned as a decimal string (`"10.50"`), because the column is `numeric` and JSON',
  '  numbers cannot carry it without losing precision. It is accepted as a number on write.',
  '',
  '### Nested resources',
  '',
  'Two entities have no endpoints of their own, because neither can exist without its parent:',
  '',
  '- **Recipes** (`Product_Ingredient`) are written as part of their product. Sending `ingredients`',
  '  on a product replaces the entire recipe.',
  '- **Order items** (`Order_Item`) live under `/orders/{orderId}/items`. Reads and writes are',
  '  scoped by the order, so an item cannot be reached through the wrong parent.',
  '',
  '### Order item status',
  '',
  'Order items move along `OPEN -> IN_PROGRESS -> READY -> SERVED`, with `REMAKE` off to the side',
  'for an item that has to be made again. Not every status may follow every other: a move is either',
  'a **forward** step, a **skip** (DRINK items only, which may jump to any later status), a one-step',
  '**undo**, a **send-back** into `REMAKE`, or a **remake** / **keep** back out of it. Re-sending the',
  'current status is accepted as a no-op. A move that is not permitted returns `409`, and items are',
  'always created at `OPEN`. The full table is on `PATCH /orders/{orderId}/items/{id}`.',
  '',
  '### Delete behaviour',
  '',
  'Rows owned by a parent are cascaded away with it; rows that are only referenced protect their',
  'referent with a 409:',
  '',
  '| Action | Result |',
  '| --- | --- |',
  '| Delete an order | its order items are deleted with it |',
  '| Delete a product | its recipe lines are deleted with it |',
  '| Delete a product that is on an order | 409 Conflict |',
  '| Delete an ingredient used by a recipe | 409 Conflict |',
  '| Delete a table that has orders | 409 Conflict |',
].join('\n');

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Smart Restaurant API')
    .setDescription(API_DESCRIPTION)
    .setVersion('1.0.0')
    .addTag('Tables', 'Tables guests are seated at.')
    .addTag('Products', 'Menu products and their recipes.')
    .addTag('Ingredients', 'Raw ingredients that products are made from.')
    .addTag('Orders', 'Orders opened on a table.')
    .addTag(
      'Order items',
      'Individual items on an order, and their progress through the kitchen. Nested under the order that owns them.',
    )
    .build();

  const documentOptions: SwaggerDocumentOptions = {
    standardSchemaConverter: (schema, { schemaType }) => {
      const converted = createSchema(schema as never, {
        io: schemaType,
        openapiVersion: '3.0.0',
      });

      return {
        schema: converted.schema,
        components: converted.components,
      };
    },
  };

  const document = SwaggerModule.createDocument(app, config, documentOptions);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      // Deep-linkable operations, and schemas expanded far enough to read a
      // nested order without clicking through every level.
      deepLinking: true,
      defaultModelsExpandDepth: 3,
      defaultModelExpandDepth: 4,
      docExpansion: 'list',
      tagsSorter: 'alpha',
    },
  });
}
