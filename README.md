# SmartRestaurant

## Prerequisites

Before setting up the project, install the following tools:

* [Node.js](https://nodejs.org/) 24 or newer
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker through WSL

## Install pnpm

Install the latest Corepack version and use it to enable pnpm 11:

```bash
npm install -g corepack@latest
corepack enable
corepack install --global pnpm@11
```

Verify the installation:

```bash
pnpm --version
```

## Install dependencies

Clone the repository and install all dependencies from the repository root:

```bash
git clone git@github.com:gigiloni/smart-restaurant.git
cd smart-restaurant
pnpm install --frozen-lockfile
```

The project uses a single pnpm lockfile to ensure that local development and CI install the same dependency versions.

## Environment

The backend environment variables are located in:

```text
backend/.env
```

The PostgreSQL connection is configured through `DATABASE_URL`.

Example:

```env
DATABASE_URL=postgresql://admin:admin@localhost:5432/smart_restaurant
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<random secret with at least 32 characters>
FRONTEND_URL=http://localhost:4200
```

The Docker Compose configuration additionally uses the PostgreSQL and pgAdmin environment variables defined in this file. Generate a unique `BETTER_AUTH_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`; sessions cannot be verified without it. `FRONTEND_URL` is the optional trusted origin for the Angular dev server.

## Start database

Start PostgreSQL and pgAdmin:

```bash
docker compose -p smart-restaurant --env-file ./backend/.env up -d
```

Check the running containers:

```bash
docker compose -p smart-restaurant ps
```

Stop the containers:

```bash
docker compose -p smart-restaurant down
```

To also remove the database volumes:

```bash
docker compose -p smart-restaurant down -v
```

> **Warning:** Removing the volumes deletes the local PostgreSQL database data.

---

## pnpm commands

Install dependencies:

```bash
pnpm install
```

Add a dependency:

```bash
pnpm add <package>
```

Add a development dependency:

```bash
pnpm add -D <package>
```

Remove a dependency:

```bash
pnpm remove <package>
```

List all workspace packages:

```bash
pnpm list -r --depth -1
```

Check why a dependency is installed:

```bash
pnpm why <package>
```

Example:

```bash
pnpm why @smart-restaurant/contracts
```

Run a script from the root `package.json`:

```bash
pnpm <script>
```

Examples:

```bash
pnpm build
pnpm lint
pnpm test
pnpm format
pnpm format:check
pnpm graph
```

---

## Nx commands

Nx is used to manage and run the projects inside the workspace.

Show all Nx projects:

```bash
pnpm nx show projects
```

Show the configuration of a project:

```bash
pnpm nx show project backend
```

Open the project dependency graph:

```bash
pnpm nx graph
```

### Backend

Start the backend:

```bash
pnpm start:backend
```

To run the Nx target directly after generating the Prisma Client:

```bash
pnpm nx serve backend
```

Build all projects (including the backend):

```bash
pnpm build
```

### Contracts

Build the shared contracts package:

```bash
pnpm nx build contracts
```

The contracts package contains shared Zod schemas and TypeScript types used across the application.

### Run tasks for multiple projects

Build all projects:

```bash
pnpm nx run-many -t build
```

Lint all projects:

```bash
pnpm nx run-many -t lint
```

Run all tests:

```bash
pnpm nx run-many -t test
```

Run multiple targets:

```bash
pnpm nx run-many -t build lint test
```

---

## Prisma

Prisma is configured inside the backend project:

```text
backend/
├── prisma.config.ts
└── prisma/
    ├── schema.prisma
    └── migrations/
```

Run Prisma commands from the `backend` directory:

```bash
cd backend
```

### Generate Prisma Client

From the repository root, generate the Prisma Client with:

```bash
pnpm db:generate
```

From the `backend` directory, the equivalent command is:

```bash
pnpm exec prisma generate
```

`pnpm dev`, `pnpm start:backend`, and `pnpm build` generate the client before
starting or building. After changing `schema.prisma` while the development
servers are already running, restart `pnpm dev` so the client is regenerated
and the backend starts with it.

### Create a migration

Create and apply a new development migration:

```bash
pnpm exec prisma migrate dev --name <migration-name>
```

Example:

```bash
pnpm exec prisma migrate dev --name init
```

Another example:

```bash
pnpm exec prisma migrate dev --name add-payment
```

After changing the Prisma schema, regenerate the client:

```bash
pnpm exec prisma generate
```

### Check migration status

```bash
pnpm exec prisma migrate status
```

### Apply existing migrations

Apply pending migrations without creating new migrations:

```bash
pnpm exec prisma migrate deploy
```

This is primarily intended for staging or production deployments.

### Reset the development database

```bash
pnpm exec prisma migrate reset
```

> **Warning:** This deletes all data in the configured database and reapplies all migrations.

### Load the sample data

`backend/prisma/seed.sql` holds sample data for local development: an Italian
trattoria with staff, tables, a menu with recipes, and orders spread across the
kitchen workflow. It covers every enum variant, so each `ProductType`,
`EmployeeRole` and `OrderItemStatus` value appears in the data.

Apply migrations, then run the Prisma seed from the repository root:

```bash
pnpm db:migrate
pnpm db:seed
```

The equivalent command from `backend/` is `pnpm exec prisma db seed`. Prisma runs `prisma/seed.mjs`, which loads the SQL over `DATABASE_URL`; Docker is only needed when PostgreSQL is run through Compose.

With `psql` installed locally, load it directly instead:

```bash
psql "$DATABASE_URL" -f backend/prisma/seed.sql
```

Re-running resets the sample tables, login accounts, and sessions, then resets the identity sequences. Use this only for disposable development data.

### Create the first admin login

The sample employees have no preset passwords. After seeding, create a login for the existing admin (employee 1). In PowerShell:

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com'
$env:BOOTSTRAP_ADMIN_PASSWORD = '<your password of at least 12 characters>'
pnpm db:bootstrap-admin
Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD
```

The command refuses to run when an active admin already exists. Without sample data, also set `BOOTSTRAP_ADMIN_FIRSTNAME` and `BOOTSTRAP_ADMIN_LASTNAME` to create the first employee. Admins can then create employees with email/password via `POST /api/employees`, or activate an existing sample employee via `POST /api/employees/{id}/account`.

### Read an existing database schema

Update `schema.prisma` based on the current database structure:

```bash
pnpm exec prisma db pull
```

### Push schema without a migration

Synchronize the database directly with `schema.prisma`:

```bash
pnpm exec prisma db push
```

This is useful for quick prototyping. Normal project development should use migrations.

### Format Prisma schema

```bash
pnpm exec prisma format
```

### Prisma Studio

Open Prisma Studio:

```bash
pnpm exec prisma studio
```

---

## Common development workflow

From the repository root, start the database:

```bash
docker compose -p smart-restaurant --env-file ./backend/.env up -d
```

Generate the Prisma Client:

```bash
pnpm db:generate
```

Build the shared contracts:

```bash
pnpm nx build contracts
```

Optionally load the sample data and create the first admin login (set the bootstrap credentials as described above):

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:bootstrap-admin
```

Start the backend:

```bash
pnpm start:backend
```

The backend API is available at:

```text
http://localhost:3000/api
```

Swagger UI is available at:

```text
http://localhost:3000/api/docs
```

The OpenAPI document is generated from the same Zod schemas the API validates
against, so it cannot drift from the code. Every operation carries a summary and
description, its path parameters, a request schema, and a schema per response
status, including the errors it can return. Side effects are called out on the
routes that have them — replacing a recipe, cascading deletes, and the
references that block a delete with `409`.

---

## API resources

All routes are served under the `/api` prefix and validated against the Zod
schemas in the `contracts` library.

| Resource | Routes |
| --- | --- |
| Tables | `GET` `POST` `/tables` · `GET` `PATCH` `DELETE` `/tables/:id` |
| Employees | `GET` `POST` `/employees` · `GET` `/employees/me` · `GET` `PATCH` `DELETE` `/employees/:id` · `POST` `/employees/:id/account` |
| Products | `GET` `POST` `/products` · `GET` `PATCH` `DELETE` `/products/:id` |
| Ingredients | `GET` `POST` `/ingredients` · `GET` `PATCH` `DELETE` `/ingredients/:id` |
| Orders | `GET` `POST` `/orders` · `GET` `PATCH` `DELETE` `/orders/:id` |
| Order items | `GET` `POST` `/orders/:orderId/items` · `GET` `PATCH` `DELETE` `/orders/:orderId/items/:id` |

### Paging

`GET /orders` is paged with two optional query parameters:

| Parameter | Meaning | Default |
| --- | --- | --- |
| `take` | How many orders to return, capped at 200 | 50 |
| `skip` | How many orders to skip before the page starts | 0 |

Both may be omitted, so a client that ignores paging still gets the newest 50
orders. `skip` counts rows rather than pages, so the second page of twenty is
`?take=20&skip=20`. The response stays a plain array and carries no total; ask
for one row more than you intend to show to find out whether another page
exists.

Every other collection is returned whole.

### Login and access rules

Sign in with `POST /api/auth/sign-in/email` using `{ "email": "...", "password": "..." }`. Better Auth returns an HTTP-only session cookie. Send that cookie with subsequent API requests. `GET /api/auth/get-session`, `POST /api/auth/change-password`, and `POST /api/auth/sign-out` are also available. Public sign-up is disabled. All business routes require a login; an unauthenticated request gets `401`, while a logged-in user without permission gets `403`.

| Role | Access |
| --- | --- |
| `ADMIN` | Full access, including employee CRUD, login activation, and role assignment. The last active admin cannot be deleted or demoted. |
| `SERVICE` | Read all orders; create and change assigned orders and their items; update own profile without changing the role; mark any product type `SERVED` or `REMAKE` when its status transition permits it. |
| `KITCHEN` | Read all orders; update preparation status (`OPEN`, `IN_PROGRESS`, `READY`) of `FOOD` and `APPETIZER` items; update own profile without changing the role. |
| `BAR` | Read all orders; update preparation status (`OPEN`, `IN_PROGRESS`, `READY`) of `DRINK` items; update own profile without changing the role. |

All signed-in staff can read tables, products, and ingredients. Only admins can change those resources. Employees can read their own profile; only admins can list all employees. Roles are read from the database for every request, so changes take effect immediately. There is no separate superuser role; the first admin is bootstrapped once and can appoint other admins.

Two entities are deliberately not exposed as standalone resources, because
neither can exist without its parent:

* **`Product_Ingredient`** is written as part of its product. A product payload
  carries an optional `ingredients` array of `{ ingredientId, amount }`. Sending
  `ingredients` on `PATCH /products/:id` replaces the whole recipe; omitting it
  leaves the recipe untouched.
* **`Order_Item`** is addressed under the order that owns it. Every route is
  nested below `/orders/:orderId`, and an item that belongs to a different order
  returns `404` rather than being readable through the wrong parent. Items can
  also be created inline via the optional `items` array on `POST /orders`.

### Order item status

Order items travel along a chain, with `REMAKE` off to the side for an item that
has to be made again:

```text
OPEN  ──►  IN_PROGRESS  ──►  READY  ──►  SERVED
```

Not every status may follow every other. `PATCH /orders/{orderId}/items/{id}`
rejects a move that is not permitted with `409 Conflict`, naming the targets that
are. Items are always created at `OPEN`.

| Move | Meaning |
| --- | --- |
| forward | The next step along the chain. Always permitted. |
| skip | A forward jump past one or more steps. `DRINK` items only. |
| undo | Exactly one step back, to correct a mis-tap. Never more than one step. |
| send-back | `READY` or `SERVED` to `REMAKE`, when an item is rejected. |
| remake | `REMAKE` to `IN_PROGRESS`, when the kitchen starts the replacement. |
| keep | `REMAKE` to `SERVED`, when the guest accepts the item after all. |
| unchanged | Re-sending the current status. Accepted as a no-op, so retries are safe. |

Rows are the current status, columns the requested one:

| from / to | OPEN | IN_PROGRESS | READY | SERVED | REMAKE |
| --- | --- | --- | --- | --- | --- |
| OPEN | unchanged | forward | skip *(DRINK)* | skip *(DRINK)* | — |
| IN_PROGRESS | undo | unchanged | forward | skip *(DRINK)* | — |
| READY | — | undo | unchanged | forward | send-back |
| SERVED | — | — | undo | unchanged | send-back |
| REMAKE | — | remake | — | keep | unchanged |

Drinks need no preparation, so a `DRINK` item may jump forward to any later
status. Skipping is one-way: `undo` stays a single step back for every product
type, so a drink that jumped `OPEN` to `SERVED` unwinds one step at a time.

The rules live in `contracts/src/lib/order-items/order-item-transitions.ts`, so
the frontend can grey out impossible moves from the same source the API enforces.

### Delete behaviour

Rows that are owned by a parent are removed with it; rows that are merely
referenced protect their referent:

| Action | Result |
| --- | --- |
| Delete an order | its order items are cascaded away |
| Delete a product | its recipe lines are cascaded away |
| Delete a product that is on an order | `409 Conflict` |
| Delete an ingredient used by a product | `409 Conflict` |
| Delete an employee who has taken an order | `409 Conflict` |
