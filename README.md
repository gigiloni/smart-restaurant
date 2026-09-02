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
```

The Docker Compose configuration additionally uses the PostgreSQL and pgAdmin environment variables defined in this file.

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
pnpm nx serve backend
```

or:

```bash
pnpm start:backend
```

Build the backend:

```bash
pnpm nx build backend
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

Generate the Prisma Client:

```bash
pnpm exec prisma generate
```

Run this command after changing `schema.prisma`.

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

The file contains data only — apply the migrations first, then load it. With the
compose stack running, no local `psql` is needed:

```bash
docker compose -p smart-restaurant --env-file ./backend/.env exec -T postgres \
  psql -U admin -d smart_restaurant < backend/prisma/seed.sql
```

With `psql` installed locally, load it directly instead:

```bash
psql "$DATABASE_URL" -f backend/prisma/seed.sql
```

Re-running is safe. Every table is truncated first and the identity sequences are
reset afterwards, so ids stay stable across reloads and the next row the API
writes does not collide with a seeded id.

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
cd backend
pnpm exec prisma generate
cd ..
```

Build the shared contracts:

```bash
pnpm nx build contracts
```

Optionally load the sample data (see [Load the sample data](#load-the-sample-data)):

```bash
docker compose -p smart-restaurant --env-file ./backend/.env exec -T postgres \
  psql -U admin -d smart_restaurant < backend/prisma/seed.sql
```

Start the backend:

```bash
pnpm nx serve backend
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
| Employees | *not implemented yet* |
| Products | `GET` `POST` `/products` · `GET` `PATCH` `DELETE` `/products/:id` |
| Ingredients | `GET` `POST` `/ingredients` · `GET` `PATCH` `DELETE` `/ingredients/:id` |
| Orders | `GET` `POST` `/orders` · `GET` `PATCH` `DELETE` `/orders/:id` |
| Order items | `GET` `POST` `/orders/:orderId/items` · `GET` `PATCH` `DELETE` `/orders/:orderId/items/:id` |

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

### Delete behaviour

Rows that are owned by a parent are removed with it; rows that are merely
referenced protect their referent:

| Action | Result |
| --- | --- |
| Delete an order | its order items are cascaded away |
| Delete a product | its recipe lines are cascaded away |
| Delete a product that is on an order | `409 Conflict` |
| Delete an ingredient used by a product | `409 Conflict` |
