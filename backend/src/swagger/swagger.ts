import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type SwaggerDocumentOptions } from '@nestjs/swagger';
import { createSchema } from 'zod-openapi';

import { GUEST_COOKIE } from '../auth/access-metadata.js';

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
  '- Business routes require a Better Auth session cookie. In this Swagger UI, run',
  '  **Authentication → Sign in** with Try it out, then test the business routes in the same browser tab.',
  '  The browser stores the HTTP-only cookie; do not enter its value in Authorize.',
  '- Role and ownership checks return 403; missing or expired sessions return 401.',
  "- Guests have no login. The guest app sends the `tableId` and `token` from the table's QR code to",
  '  `POST /viewer/guest`, which sets the HTTP-only `sr_guest` cookie. Only routes that say so accept',
  '  it: the menu (`GET /products`) and `GET /viewer`. It stops working when service clears the table.',
  '- Request bodies and path parameters are validated against the Zod schemas in the shared',
  '  `@smart-restaurant/contracts` library, so the frontend and the backend agree on one definition.',
  '- Ids are auto-incrementing integers. Path parameters arrive as strings and are coerced, so',
  '  `/products/1` and `/products/01` address the same product, while `/products/abc` fails with 400.',
  '- `GET /orders` is paged with the optional `take` and `skip` query parameters, and returns the',
  '  newest 50 orders when they are omitted. Every other collection is returned whole.',
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
  '### Table sessions and payment',
  '',
  "Orders belong to a **table session**: one party's time at a table. The first QR scan — or the first",
  'order — at a free table opens a session; every later scan joins it. A table has at most one open',
  'session, so a table is free exactly when no open session names it.',
  '',
  '- `POST /orders/{id}/close` takes payment for one order. Everything on it must have been served, and',
  '  the order is frozen from then on.',
  '- `POST /table-sessions/{id}/close` clears the table once every order in the session is paid.',
  '- `PATCH /table-sessions/{id}` moves the whole party, orders included, to a free table.',
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
  '| Delete an open order | its order items are deleted with it |',
  '| Delete or change a closed order | 409 Conflict: it has been paid |',
  '| Delete a product | its recipe lines are deleted with it |',
  '| Delete a product that is on an order | 409 Conflict |',
  '| Delete an ingredient used by a recipe | 409 Conflict |',
  '| Delete an employee who has taken an order | 409 Conflict |',
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
    .addTag('Employees', 'Members of staff, who may be assigned to the orders they take.')
    .addTag(
      'Table sessions',
      "One party's time at a table, from the first QR scan until service clears it. Orders belong to a session.",
    )
    .addTag('Orders', 'Orders placed by the party at a table, and paid one at a time.')
    .addTag('Authentication', 'Better Auth email/password session endpoints.')
    .addTag('Viewer', 'Who is asking: staff by login, guests by the QR code on their table.')
    .addTag(
      'Order items',
      'Individual items on an order, and their progress through the kitchen. Nested under the order that owns them.',
    )
    // Named explicitly: the default scheme name is `cookie` for both, so the
    // second would replace the first and the requirements would dangle.
    .addCookieAuth(
      'better-auth.session_token',
      { type: 'apiKey', description: 'Staff login, set by Authentication → Sign in.' },
      'better-auth.session_token',
    )
    .addCookieAuth(
      GUEST_COOKIE,
      { type: 'apiKey', description: 'Guest access, set by `POST /viewer/guest`.' },
      GUEST_COOKIE,
    )
    .addSecurityRequirements('better-auth.session_token')
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

  // The one route that needs no identity: it is how a guest gets one.
  const enterAsGuest = document.paths['/api/viewer/guest']?.post;
  if (enterAsGuest) {
    enterAsGuest.security = [];
  }

  // Better Auth owns these Fastify routes, so Nest cannot discover them from
  // controller decorators. Document the login that sets the browser cookie.
  document.paths['/api/auth/sign-in/email'] = {
    post: {
      tags: ['Authentication'],
      summary: 'Sign in with email and password',
      description:
        'Use Try it out from this Swagger page. A successful response sets the HTTP-only session cookie; subsequent requests from this page send it automatically.',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', format: 'password' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Signed in. The browser stores the session cookie.',
          headers: {
            'Set-Cookie': {
              description: 'HTTP-only Better Auth session cookie.',
              schema: { type: 'string' },
            },
          },
        },
        '401': { description: 'Invalid email or password.' },
      },
    },
  };

  document.paths['/api/auth/sign-out'] = {
    post: {
      tags: ['Authentication'],
      summary: 'Sign out',
      description: 'Clears the current session cookie.',
      responses: {
        '200': { description: 'Signed out.' },
      },
    },
  };

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      withCredentials: true,
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
