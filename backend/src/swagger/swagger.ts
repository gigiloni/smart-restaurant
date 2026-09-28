import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
  type ReferenceObject,
  type SchemaObject,
  type SwaggerDocumentOptions,
} from '@nestjs/swagger';
import { liveReadySchema, liveResyncSchema, orderEventSchema } from '@smart-restaurant/contracts';
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
  '  it: the menu (`GET /products`), ordering for their own party (`POST /orders`, `POST /orders/{id}/items`),',
  '  the live updates (`/live/*`) and `GET /viewer`. It stops working when service clears the table.',
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
  '### Seating and order lifecycles',
  '',
  "Orders belong to a **table session**: one party's time at a table, from the first QR scan until",
  'service clears the table. A table is free exactly when no open session names it.',
  '',
  '#### Seating',
  '',
  '```text',
  '                  QR scan, staff seats, or first order                service clears the table',
  '   FREE  ─────────────────────────────────────────────►  SEATED  ─────────────────────────────►  FREE',
  '   (no open session)           session.opened              │  ▲    only once every order is CLOSED',
  '                                                           │  │              session.closed',
  '                                                           └──┘',
  '                                           party moves to a free table: session.moved',
  '```',
  '',
  '| Step | Who | Request | Live event | What the frontend does |',
  '| --- | --- | --- | --- | --- |',
  'open the stream, show the menu (`GET /products`), and let the guest order with `POST /orders`. |',
  '| Staff seats a party | `SERVICE`, `ADMIN` | `POST /table-sessions` with `tableId`. 201 / 200 as above | `session.opened` on 201 | Show the table as occupied. |',
  '| First order at a free table | `SERVICE`, `ADMIN` | `POST /orders` | `session.opened`, then `order.created` | Same as seating, then add the order. |',
  '| Party moves | `SERVICE`, `ADMIN` | `PATCH /table-sessions/{id}` with the free target `tableId`. 409 if it is taken | `session.moved` | Update the session **and every order in it** to the new table. Guests stay connected. |',
  '| Clear the table | `SERVICE`, `ADMIN` | `POST /table-sessions/{id}/close`. 409 while any order is unpaid | `session.closed` | Staff: drop the session and its orders; the table is free. Guest: the stream ends and the cookie stops working: show a goodbye screen. |',
  '',
  'Seating, paying and clearing are idempotent, so a retried request is safe. Scans that arrive at the',
  'same moment on a free table still land in one session.',
  '',
  '#### Order',
  '',
  '```text',
  '   POST /orders ──►  OPEN  ──── every item SERVED, then POST /orders/{id}/close ────►  CLOSED',
  '                      │                        order.closed                          paid, frozen',
  '                      └──── DELETE /orders/{id} ────► deleted  (order.deleted)',
  '```',
  '',
  '| Step | Who | Request | Live event |',
  '| --- | --- | --- | --- |',
  '| Place an order | `SERVICE` (assigned to themselves), `ADMIN`, guests (their own party, unassigned, at least one item) | `POST /orders` with `tableId` and optional `items` | `order.created` |',
  "| Add an item | the order's employee, `ADMIN`, guests (open orders of their own party) | `POST /orders/{id}/items` | `item.created` |",
  '| Prepare an item | `KITCHEN` for `APPETIZER`/`FOOD`, `BAR` for `DRINK`, `ADMIN` | `PATCH /orders/{id}/items/{itemId}` to `IN_PROGRESS`, `READY` | `item.status_changed` |',
  '| Serve or send back an item | `SERVICE`, `ADMIN` | `PATCH /orders/{id}/items/{itemId}` to `SERVED`, `REMAKE` | `item.status_changed` |',
  "| Remove an item | the order's employee, `ADMIN` | `DELETE /orders/{id}/items/{itemId}` | `item.deleted` |",
  '| Claim an unassigned order | `SERVICE` | `PATCH /orders/{id}` with their own `employeeId`. 409 if another employee claimed it first | `order.updated` |',
  '| Reassign the order | `ADMIN` | `PATCH /orders/{id}` with `employeeId` | `order.updated` |',
  "| Take payment | the order's employee, `ADMIN` | `POST /orders/{id}/close`. 409 while any item is not `SERVED` | `order.closed` |",
  "| Cancel the order | the order's employee, `ADMIN` | `DELETE /orders/{id}` | `order.deleted` |",
  '',
  '"The order\'s employee" includes any `SERVICE` employee while the order is unassigned, as every guest',
  'order is. Guests cannot change item status, remove items, pay or cancel; they ask the staff.',
  '',
  'Payment is per order: a party may pay order by order, and the table can be cleared once every order is',
  '`CLOSED`. A closed order is frozen: every change to it or its items returns 409. Items move through',
  '`OPEN → IN_PROGRESS → READY → SERVED`; see **Order item status** for the permitted moves.',
  '',
  '### Live updates',
  '',
  'Load `GET /live/snapshot`, then open `GET /live/events?since=<cursor>` with an `EventSource`. The stream',
  'sends every change after the snapshot that the caller may see, and resumes from `Last-Event-ID` after a',
  'dropped connection, so no update is lost. The payloads are the `OrderEvent`, `LiveReady` and `LiveResync`',
  'schemas below.',
  '',
  'A client must follow these rules, or its state drifts from the server:',
  '',
  '1. **Snapshot first.** Render the snapshot, then connect with its `cursor` as `since`. Let the browser',
  '   reconnect by itself: it sends `Last-Event-ID`, which the server prefers over `since`.',
  '2. **Apply in order, by replacing.** Each event carries the whole entity after the change, or before it',
  '   for `*.deleted`. Replace the entity by id; do not merge fields. Applying an event twice is harmless.',
  '3. **`session.moved` moves orders too.** No `order.*` event is sent for the orders of a moved party. Set',
  "   `tableId` and `table` of every order in that session from the event's `session`.",
  '4. **On `resync`, start over.** Call `close()` on the EventSource, reload the snapshot and connect again',
  '   with its cursor. Without `close()`, the browser reconnects into the same `resync` forever.',
  '5. **Kitchen and bar: hide orders with no items.** When the last item for the station is deleted, the',
  "   order stays in the client's state with no items left.",
  '6. **One EventSource per tab.** Browsers allow about six HTTP/1.1 connections per origin, and every',
  "   open stream holds one. Share a single stream across the app's views.",
  '7. **Guests: `session.closed` ends it.** The stream closes and the guest cookie stops working. Show a',
  '   goodbye screen, not a reconnect spinner.',
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
    .addTag(
      'Live',
      'Realtime orders: a consistent snapshot, then a Server-Sent Events stream of every change after it, scoped to the caller.',
    )
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

  documentLiveEvents(document);

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

/**
 * No route returns the SSE message payloads as JSON, so Nest never registers
 * their schemas. Add them as components and point the stream's response at
 * them, so the event shapes can be read in the docs.
 */
function documentLiveEvents(document: OpenAPIObject): void {
  const components = (document.components ??= {});
  const schemas = (components.schemas ??= {});

  const refs = [orderEventSchema, liveReadySchema, liveResyncSchema].map((schema) => {
    const { schema: converted, components: nested } = createSchema(schema, {
      io: 'output',
      openapiVersion: '3.0.0',
    });

    Object.assign(schemas, nested);

    return converted;
  });

  const stream = document.paths['/api/live/events']?.get?.responses?.['200'];

  if (stream && !('$ref' in stream)) {
    stream.content = {
      'text/event-stream': {
        schema: {
          description:
            "Each message's `data` is one of these, as JSON: an `OrderEvent` for a change (the SSE `event` is its `type`), `LiveReady` for `event: ready`, `LiveResync` for `event: resync`.",
          oneOf: refs as (SchemaObject | ReferenceObject)[],
        },
      },
    };
  }
}
