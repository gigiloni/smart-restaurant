# Backend test plan – Smart Restaurant

Scope: the `backend` (NestJS/Fastify/Prisma) and the parts of `contracts` it
enforces. Unit and integration tests only. The frontend team sets up its own
tests; browser end-to-end tests and load tests are out of scope here.

Status: **design and plan**. No test code is committed yet. Every case below
was checked for soundness against the running backend before it went into this
plan. How, and with what result, is in [Verification](#7-verification).

## Contents

1. [Sources](#1-sources)
2. [Requirements traceability](#2-requirements-traceability)
3. [Strategy](#3-strategy)
4. [Tooling and setup](#4-tooling-and-setup)
5. [Conventions](#5-conventions)
6. [Test catalogue](#6-test-catalogue)
7. [Verification](#7-verification)
8. [Findings for the team](#8-findings-for-the-team)
9. [Pending tests](#9-pending-tests)
10. [Rollout](#10-rollout)

---

## 1. Sources

Expected behaviour was taken from these sources, in this order of authority:

| Source | What it contributes |
| --- | --- |
| Projektauftrag Smart Restaurant (Schulcloud, LF10 project board) | The functional requirements of the assignment (R1–R14 below). |
| Team kick-off document and user stories (Schulcloud, Schritt 1 and 3) | Additions the team committed to: guest login by table code, remake, priority, stock, role-based access (K1–K6). |
| `README.md`, `docs/Benutzerdokumentation.md`, `docs/Entwicklerdokumentation.md` | The documented API: lifecycles, transition table, delete rules, live-update semantics, guest rules. |
| `contracts/src/**` | Validation rules, response shapes, the status-transition rules. |
| `backend/src/**`, Prisma schema and migrations | Behaviour the documents do not spell out (error mapping, idempotency, locking). |

Where these disagree, the plan follows the documented API and lists the
disagreement under [Findings](#8-findings-for-the-team) instead of encoding it
in a test.

### Assumptions

- **A1 – Access control is off.** Every route is public except
  `GET /employees/me` (README, *Login and access rules*). Integration tests
  therefore run anonymously unless a case is about identity (staff login,
  guest cookie). The role rules stay covered by unit tests of `AccessService`.
  The role matrix per route is [pending](#9-pending-tests) until access control
  is switched back on.
- **A2 – One quantity is one row.** An order item is a single unit; two pizzas
  are two items (contract `createOrderItemSchema`). Requirement R5's "quantity"
  is tested that way.
- **A3 – "Paid" is the order status `CLOSED`.** The assignment's status chain
  *aufgegeben → in Bearbeitung → fertig → serviert → bezahlt* maps to the item
  chain `OPEN → IN_PROGRESS → READY → SERVED` plus closing the order.
- **A4 – Tests own their database.** Integration tests run against a
  dedicated, disposable PostgreSQL database, never the development one.

---

## 2. Requirements traceability

Status: ✅ implemented and covered · ⚠️ partly implemented · ❌ not implemented
(no test possible yet, see [Findings](#8-findings-for-the-team)).

| ID | Requirement (Projektauftrag) | Status | Test cases |
| --- | --- | --- | --- |
| R1 | Tables with a unique table number and 2–8 seats | ⚠️ unique ✅, seat range not enforced (F1) | I-TBL-03…05, U-CT-06 |
| R2 | Table status free / occupied | ✅ occupied = an open table session | I-SES-01, I-SES-06, I-DB-01, I-CON-01 |
| R3 | A table can place several orders | ✅ | I-ORD-02 |
| R4 | An order is stored with date and time | ❌ orders have no creation time (F2) | – |
| R5 | Order items with article and quantity | ✅ quantity = repeated items (A2) | I-ORD-01, I-ITM-01 |
| R6 | Article: name, price, category; the category routes it to kitchen or bar | ✅ | U-CT-07, I-PRD-04, U-LS-06…08, I-LIV-04, I-LIV-12 |
| R7 | Status chain placed → in progress → ready → served → paid | ✅ (A3) | U-CT-01, U-CT-02, I-ITM-03…06, I-ORD-08 |
| R8 | Employees with name, username, role (≥ Service, Kitchen, Bar, Admin) | ✅ username = login email | U-CT-08, I-EMP-01…02 |
| R9 | Every status change logged with employee, timestamp, order | ⚠️ logged with timestamp and order, not the employee (F3) | I-EVT-01…03, I-ITM-04 |
| R10 | Statistics: weekly revenue, best-selling drink | ❌ (F4) | – |
| R11 | Service: choose table, enter order, mark served, show bill, close order | ✅ (bill = the order with its items and prices) | I-SES-*, I-ORD-*, I-ITM-03…05 |
| R12 | Kitchen: kitchen orders sorted by arrival; set in progress / ready | ✅ arrival = order id; role check dormant (A1) | I-LIV-04, U-SV-ITM-*, U-AC-06 |
| R13 | Bar: drink orders, open ones first | ✅ the bar sees open orders only | I-LIV-04, I-LIV-12 |
| R14 | Admin: CRUD for employees, articles, tables | ✅ | I-EMP-*, I-PRD-*, I-ING-*, I-TBL-* |
| K1 | Guests sign in with the table code; menu and cart | ✅ QR token, cart = `products-by-id` | I-GST-*, I-PRD-02…03, U-GA-* |
| K2 | Remake sends the item back to the kitchen | ✅ | U-CT-01, I-ITM-05…06 |
| K3 | Remake also takes the item out of stock | ❌ no stock (F4) | – |
| K4 | Priority, adjustable, escalating after 10 minutes | ❌ (F4) | – |
| K5 | Stock management, monitoring (revenue, best sellers, staff statistics) | ❌ (F4) | – |
| K6 | Several roles with authentication and authorization | ⚠️ implemented, switched off (A1, F6) | U-AC-*, U-AG-*, U-VR-*, I-EMP-02…03, I-EMP-09, I-GST-03 |

---

## 3. Strategy

### Test levels

| Level | What runs | Database | Typical speed |
| --- | --- | --- | --- |
| **Unit – pure** | Functions and schemas from `contracts`, `live-scope`, `AccessService`, `GuestAccessService` | none | < 1 ms per case |
| **Unit – service** | One service or class with its collaborators replaced by `vi.fn()` mocks; Nest DI only where `@Transactional()` needs it | none | a few ms |
| **Integration – HTTP** | The whole `AppModule` behind Fastify, called with `app.inject()`: routing, validation pipe, guard, services, Prisma, PostgreSQL | real test DB | 10–100 ms |
| **Integration – stream** | The same app listening on a random port; the SSE stream read with `fetch` | real test DB | 0.3–1 s |
| **Integration – concurrency** | Several requests at once, repeated over ten rounds, asserting invariants in the DB | real test DB | 1–3 s per case |

### What goes where

- **Rules with many combinations** (the 5 × 5 × 3 transition matrix, the
  role × product type × status matrix, schema boundaries) are unit tests:
  exhaustive, fast and independent of the database.
- **Error mapping and branch logic in services** (Prisma `P2002`/`P2003`/`P2025`
  to 409/400, idempotent no-ops, retry loops) are unit tests with mocks, because
  the failure that triggers a branch is hard to produce on purpose.
- **Anything the database decides** (unique and partial indexes, cascades,
  foreign keys, row locks, `REPEATABLE READ` snapshots, `LISTEN/NOTIFY`) is an
  integration test. Mocking these would test the mock.
- **Each integration case asserts the HTTP status, the body, and the side
  effect**: the row in the DB, or the event in `Order_Event`. Three cheap
  assertions per request catch most regressions.

### Out of scope

Browser end-to-end tests (frontend team), load and performance tests,
Better Auth's own behaviour beyond the four exposed routes, and the Prisma
migrations themselves (they run in the integration setup, so a broken
migration fails every test).

---

## 4. Tooling and setup

### Choice: Vitest with SWC

| Option | Verdict |
| --- | --- |
| **Vitest + `unplugin-swc`** | ✅ Chosen and verified. Native ESM; the backend is `"type": "module"` with `NodeNext` imports. SWC emits the decorator metadata that Nest's dependency injection needs, which plain esbuild does not. |
| Jest + `ts-jest` | ❌ ESM support is still experimental, and the `.js` import suffixes of `NodeNext` need extra mapping. |
| `node:test` + `tsx` | ❌ esbuild emits no `emitDecoratorMetadata`, so `AppModule` cannot be built: constructor injection breaks. |

Development dependencies to add (versions verified 2026-10-01):

```bash
pnpm add -D -w vitest@^5 unplugin-swc@^2 @swc/core@^1.16 @nestjs/testing@^12
```

`@nestjs/testing` is not in `dev/main` yet. `@swc/core` installs its native
binary as an optional dependency; pnpm's "ignored build scripts" notice for it
is harmless.

### Configuration

`backend/vitest.config.ts`:

```ts
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      '@smart-restaurant/contracts': new URL('../contracts/src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.spec.ts', '../contracts/src/**/*.spec.ts'] } },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/**/*.int-spec.ts'],
          setupFiles: ['test/setup-env.ts'],
          globalSetup: ['test/global-setup.ts'],
          fileParallelism: false, // one database, files run one after another
          testTimeout: 20_000,
        },
      },
    ],
  },
});
```

Scripts and Nx target:

| Command | Runs |
| --- | --- |
| `pnpm nx test backend` | both projects (Nx target `test` → `vitest run`) |
| `pnpm --dir backend exec vitest run --project unit` | unit only: no database needed |
| `pnpm --dir backend exec vitest run --project integration` | integration: needs PostgreSQL |

Keep `**/*.spec.ts` excluded in `backend/tsconfig.build.json` (it already is)
and exclude `test/` too, so tests never reach `dist/`.

### Prerequisite: one place that configures the app

`main.ts` sets the global prefix, the validation pipe, CORS, Swagger and the
`/api/auth/*` route inline before `listen()`. Integration tests must build the
**same** app, or they test something else. Move those steps into an exported
`configureApp(app)` (e.g. `backend/src/app/configure-app.ts`). `main.ts` and the
test setup both call it. This is a small refactor and the only production
change the plan needs.

### Test database

- A separate database, e.g. `smart_restaurant_test`, set through
  `backend/.env.test` (`DATABASE_URL=…/smart_restaurant_test`,
  `NODE_ENV=test`, a 32-character test `BETTER_AUTH_SECRET`,
  `FRONTEND_URL=http://localhost:4200`).
- `test/setup-env.ts` loads that file **with `override: true`** before any test
  imports `AppModule`. Variables already in `process.env` take precedence over
  the `.env` file `ConfigModule` reads, so this is what points the app at the
  test database:

  ```ts
  import { config } from 'dotenv';
  config({ path: new URL('../.env.test', import.meta.url).pathname, override: true });
  ```

- `test/global-setup.ts` runs `prisma migrate deploy` once per run, so a broken
  migration fails fast. It passes the `.env.test` values to the child process
  (`config({ path, processEnv: {} }).parsed`), because `prisma.config.ts` would
  otherwise read `backend/.env`.
- Each integration file starts with a reset: truncate every table, reset the
  sequences, set `Order_Event_Counter` back to 0. Then the file creates the
  fixtures it needs through the API. Avoid `seed.sql` as test data: it is sample
  data that will keep changing.
- `fileParallelism: false` for integration tests. Files share one database.
  Cases within a file run in order.

### Unit tests of `@Transactional()` services

Calling a `@Transactional()` method outside Nest fails with *"TransactionHost
not initialized"*. Build a small testing module with the library's no-op
adapter instead. The method then runs, without a real transaction:

```ts
const moduleRef = await Test.createTestingModule({
  imports: [
    ClsModule.forRoot({
      global: true,
      plugins: [new ClsPluginTransactional({
        adapter: new NoOpTransactionalAdapter({ tx: {}, disableWarning: true }),
      })],
    }),
  ],
  providers: [
    TableSessionsService,
    { provide: TableSessionsRepository, useValue: repo },
    { provide: OrderEventsWriter, useValue: events },
    { provide: RowLocks, useValue: locks },
  ],
}).compile();
```

Classes without `@Transactional()` (`TablesService`, `AccessService`,
`GuestAccessService`, `AuthGuard`, `OrderLock`, …) are constructed directly
with `new`.

### CI

The repository has no CI workflow yet. Once one exists, run the unit project on
every push, and the integration project with a `postgres:18-alpine` service
container, the same image as `compose.yml`.

---

## 5. Conventions

- **Layout.** Unit tests live next to the code (`orders.service.spec.ts`).
  Integration tests go in `backend/test/` (`orders.int-spec.ts`), with shared
  helpers in `backend/test/support/` (`app.ts`, `db.ts`, `fixtures.ts`,
  `sse.ts`).
- **Names carry the catalogue ID**: `it('I-ORD-08 close: 409 while items are unserved, …')`.
  A failing test then points straight at this plan.
- **Fixtures through the API, not SQL**, except to set up states the API cannot
  reach (e.g. a pruned event log). Give unique keys from a counter, never from
  `Math.random()` (see V-3).
- **Assert the side effect, not only the status**: the row, the cascade, or
  the event (`SELECT … FROM "Order_Event" WHERE order_event_id > :head`).
- **Validate responses with the contract schemas** (`orderSchema.parse(body)`),
  so a response that drifts from `contracts` fails the test.
- **Pitfalls found while verifying this plan:**
  - node-postgres returns Postgres enum arrays as the raw string `'{FOOD}'`.
    Cast in SQL: `product_types::text[]`.
  - `Order_Event.order_event_id` is `bigint` and comes back as a string. Cast
    with `::int` in test queries.
  - Don't compare an API sort with JavaScript's `sort()` on arbitrary names: the
    database collation decides, and it differs from code-point order for
    umlauts and case. Use controlled fixture names.
  - SSE needs a real socket (`app.listen({ port: 0 })`). `app.inject()` waits
    for a response that never ends.
  - Prices come back as decimal strings without padding: `3.5` is `"3.5"`, not
    `"3.50"`.

---

## 6. Test catalogue

**Level:** U = unit, I = integration. **Src:** where the expectation comes from:
R/K = requirement (§2), RM = README, C = contracts, Code = source only.
Parameterised rows expand to several test cases, given as ×n.

### 6.1 Unit – contracts (`contracts/src/**`)

| ID | Case | Expected | Src |
| --- | --- | --- | --- |
| U-CT-01 | Every transition from × to × product type (×75) | Matches the README table: forward, skip only for `DRINK`, undo exactly one step, send-back from `READY`/`SERVED`, remake, keep, unchanged; everything else `null` | RM, R7, K2 |
| U-CT-02 | `permittedOrderItemTargets` | `FOOD OPEN → [IN_PROGRESS]`; `DRINK OPEN → [IN_PROGRESS, READY, SERVED]`; `READY → [IN_PROGRESS, SERVED, REMAKE]`; `REMAKE → [IN_PROGRESS, SERVED]`; never includes `from` | C |
| U-CT-03 | `idParamSchema` (×8) | `"1"` → 1; `"2147483647"` accepted; `"0"`, `"-1"`, `"1.5"`, `"abc"`, `""`, `"2147483648"` rejected | C |
| U-CT-04 | Pagination (×6) | Defaults `{take: 50, skip: 0}`; `take=200` ok; `take=201`, `take=0`, `skip=-1`, `take=x` rejected | RM |
| U-CT-05 | Product `ids` query and body (×16) | `3,1,7`, repeated `ids=` and mixed forms parse; duplicates removed; 100 ids ok, 101 rejected (also 101 copies of one id: the limit counts before de-duplication); `""`, `abc`, `1,,2`, `0` rejected; body `[]`, strings, fractions, missing rejected | RM, C |
| U-CT-06 | Tables (×7) | `seats` defaults to 0; `tableNumber` ≥ 1; `seats` ≥ 0; `PATCH {}` rejected; `seats: 100` accepted (F1) | C, R1 |
| U-CT-07 | Products (×11) | Name trimmed, 1–100 chars; description ≤ 100, `null` allowed; price ≥ 0; unknown type rejected; an ingredient listed twice rejected; `amount` defaults to 0; `PATCH {}` rejected, `{ingredients: []}` accepted | C, R6 |
| U-CT-08 | Employees (×9) | Password 12–128 chars; email validated; role required on create; unknown role rejected; `PATCH {}` rejected; ingredient name trimmed | C, R8 |
| U-CT-09 | Orders, items, viewer, live (×10) | `employeeId` optional and nullable; `items: []` passes the schema (the guest rule is in the service); `tableId` required; `PATCH /orders` requires the `employeeId` key; item status enum; guest token 1–200 chars; `since` coerced, ≥ 0 | C |

### 6.2 Unit – auth (`backend/src/auth/**`)

| ID | Case | Expected | Src |
| --- | --- | --- | --- |
| U-AC-01…05 | `AccessService` admin, own-profile, role assignment, service, order-owner rules | 403 exactly where the README role table forbids. An unassigned order may be changed by any `SERVICE`; an assigned one only by its employee or `ADMIN`; `KITCHEN`/`BAR` never | RM, K6 |
| U-AC-06 | `requireStatusChange`, role × product type × target (×60) | `ADMIN` all; `SERVICE` only `SERVED`/`REMAKE`, any type; `KITCHEN` `OPEN`/`IN_PROGRESS`/`READY` for `FOOD`/`APPETIZER`; `BAR` the same for `DRINK` | RM, R12, R13 |
| U-GA-01…03 | QR token | Deterministic per table; differs per table and per secret; verify rejects other tables' tokens and strings of a different length | RM |
| U-GA-04…05 | Guest cookie | `sr_guest=<id>.<mac>; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`; `Secure` only when `BETTER_AUTH_URL` is https | RM |
| U-GA-06…08 | Cookie resolution | Valid cookie of an open session → guest viewer; closed or missing session → `null`; malformed, zero, negative, swapped id or forged MAC → `null` **without a DB query** | RM, Code |
| U-AG-01…05 | `AuthGuard` origin check | Non-GET from a foreign `Origin` → 403; from `FRONTEND_URL` or `BETTER_AUTH_URL` → allowed (trailing slash normalised); no `Origin` → allowed; GET always allowed | RM, Code |
| U-AG-06…09 | `AuthGuard` login requirement | Unmarked route → allowed even anonymously; `@RequireLogin()` → 401 for anonymous and guests; `@RequireLogin({guests: true})` → guests allowed, anonymous 401 with the QR hint; `request.employee`/`request.viewer` populated | RM, A1 |
| U-VR-01…04 | `ViewerResolver` | Staff login wins over a guest cookie; guest when not signed in; `allowGuests: false` ignores guests; a login without an employee row → anonymous | Code |

### 6.3 Unit – services (`backend/src/**/**.service.ts`, `order-lock.ts`)

| ID | Case | Expected | Src |
| --- | --- | --- | --- |
| U-SV-TBL-01…05 | Tables service | Missing → 404 (and no write attempted); duplicate number `P2002` → 409 naming the number; delete with references `P2003` → 409; other errors rethrown unchanged | RM, Code |
| U-SV-EMP-01…05 | Employees service | Email taken `P2002` → 409; provisioning an employee that already has a login → 409; unknown → 404; delete with orders `P2003` → 409; the last-admin 409 passes through | RM |
| U-SV-PRD-01…04 | Products and ingredients | Unknown ingredient (`P2003`/`P2025`) → 400; delete of an ordered product → 409; ids passed through; delete of a used ingredient → 409 | RM |
| U-SV-LCK-01…06 | `OrderLock.forChange` | Missing → 404; another party's order, for a guest → **404, not 403**; not the owner → 403; closed → 409; closed with `allowClosed` → returned; precedence 404 > 403 > 409 | RM, Code |
| U-SV-ORD-01…05 | Guest orders | `employeeId` set → 403; no items → 400; party moved → 409 naming the current table number; table cleared → 409; success → unassigned, placed in the guest's session, `order.created` written | RM, K1 |
| U-SV-ORD-06…08 | Staff orders | Table cleared between join and lock → retries once in the new session; cleared twice → 409; unknown product/table/employee → 400 | Code |
| U-SV-ORD-09…12 | Close / update | Unserved items → 409 with the count, no event; already closed → no-op, no event, lock taken with `allowClosed`; all served → closed and `order.closed`; unknown employee on reassign → 400 | RM, R7 |
| U-SV-ITM-01…08 | Item status | Forbidden move → 409 naming the permitted targets, with the "only DRINK items may skip" hint only when the type is the reason; unchanged → returns the item, no write, no event; lost optimistic check → 409; success → `item.status_changed` with the previous status; item not on the order → 404; unknown product → 400; status moves skip the ownership check | RM, C |
| U-SV-SES-01…09 | Table sessions | Join existing → no event; open free → `session.opened`; insert race `P2002` → joins the winner; unknown table → 400; move to an occupied table → 409; move a closed session → 409, missing → 404; move to its own table → no write, no event; close with unpaid orders → 409 (plural message); close an already closed session → no event | RM |

### 6.4 Unit – live updates (`backend/src/live/**`)

| ID | Case | Expected | Src |
| --- | --- | --- | --- |
| U-LS-01 | `stationProductTypes` | `KITCHEN` → `APPETIZER, FOOD`; `BAR` → `DRINK`; others, guests, anonymous → `null` | RM |
| U-LS-02…05 | Scope for anonymous / service / admin / guest | Everything unchanged for the first three; a guest only their own session, order events without `employeeId`/`employee`, `session.closed` included | RM |
| U-LS-06…08 | Scope for kitchen and bar | Item events by product type; order events only with station items, other items removed; `session.opened`/`closed` never; `session.moved` only if the session holds station items | RM, R6 |
| U-LS-09…10 | Purity | Scoping never mutates the logged event (it is shared by every client); `onlyStationItems` filters | Code |
| U-LST-01…04 | Catch-up | Backlog in id order, then `ready` with the cursor and `retry: 2000`; `since` ahead of the log → `resync cursor_unknown` and complete; gap in the backlog → `cursor_expired`; live events held during catch-up, duplicates dropped | RM |
| U-LST-05…08 | Live | Gap after `ready` → `cursor_expired`; hidden events advance the cursor and `ready` carries it; feed reset → `resync log_reset`; shutdown → complete without resync; a guest's stream ends after their `session.closed` | RM |
| U-LST-09…12 | Timers and teardown (fake timers) | A heartbeat comment every 15 s; revalidation every 60 s: logged out → complete, role changed → `resync scope_changed`, anonymous never revalidates; unsubscribe stops timers and the feed subscription; a log error errors the stream | RM |
| U-FD-01…04 | `OrderEventFeed.readTail` / `poke` | Publishes new events in order and tracks its position; head moved backwards → `reset`; gap → `reset`; overlapping `poke()` calls fold into one extra read | RM, Code |

### 6.5 Integration – master data

| ID | Case | Expected | Src |
| --- | --- | --- | --- |
| I-TBL-01 | List | 200, sorted by `tableNumber`, every row matches `tableSchema` | RM |
| I-TBL-02 | Bad ids | 404 unknown; 400 `abc` (message array); 400 above int32 | RM, C |
| I-TBL-03 | Create | 201, `seats` 0 when omitted | C |
| I-TBL-04 | Duplicate number | 409 on create and on patch | R1 |
| I-TBL-05 | Patch | `{}` → 400; unknown → 404; valid → 200 | RM |
| I-TBL-06 | Delete unused table | 200 returns the row; then 404 | RM |
| I-TBL-07 | Delete a table that has seated a party | 409 | RM |
| I-TBL-08 | QR code | 200 `{tableId, tableNumber, token}`, token is 43 base64url chars; 404 for an unknown table | RM, K1 |
| I-TBL-09 | Unknown body fields | Stripped, not stored (`id` in the body is ignored) | Code |
| I-EMP-01 | List | Sorted by last name, then first name; exactly `id, firstname, lastname, role`: no email, no auth ids | RM, R8 |
| I-EMP-02 | Create with login | 201; the login works; email unique **case-insensitively** → 409 | RM, K6 |
| I-EMP-03 | Auth routes | Wrong password 401; `POST /api/auth/sign-up/email` → 404 (public sign-up disabled) | RM |
| I-EMP-04 | Validation | Short password, unknown role → 400 | C |
| I-EMP-05 | Add a login to an existing employee | 201; a second time 409; unknown employee 404 | RM |
| I-EMP-06 | Last active admin | Demoting or deleting the only admin *with a login* → 409; an admin without a login may be demoted; with two active admins one may be demoted | RM |
| I-EMP-07 | Delete | Employee who took an order → 409; deleting an employee with a login also deletes the auth user, and sign-in fails afterwards | RM |
| I-EMP-08 | Rename | The auth user's display name follows | Code |
| I-EMP-09 | `GET /employees/me` | Anonymous 401, guest 401, staff 200 with their own profile | RM |
| I-EMP-10 | Get one | 200 / 404 | RM |
| I-ING-01 | CRUD | Name trimmed; list sorted by name; patch; delete; then 404 | RM |
| I-ING-02 | Delete an ingredient used in a recipe | 409 | RM |
| I-PRD-01 | List | Sorted by name; every row matches `productSchema`; recipe resolved | RM |
| I-PRD-02 | `?ids=` | Filters, removes duplicates, ignores unknown ids, both syntaxes; `abc` and 101 ids → 400 | RM |
| I-PRD-03 | `POST /products-by-id` | **200** (not 201), same result as `GET ?ids=`; empty or missing `ids` → 400 | RM |
| I-PRD-04 | Create with recipe | 201; price as a decimal string; recipe lines carry the ingredient | RM, R6 |
| I-PRD-05 | Bad recipe | Unknown ingredient → 400 **and no product is created**; duplicate ingredient → 400 | RM |
| I-PRD-06 | Recipe update rules | Patch without `ingredients` keeps the recipe; with `ingredients` replaces it; `[]` clears it; `description: null` clears it | RM |
| I-PRD-07 | Atomic recipe replacement | Patch with an unknown ingredient → 400 and the old recipe is still there | RM |
| I-PRD-08 | Delete | Cascades the recipe lines; a product that is on an order → 409 | RM |
| I-PRD-09 | Master data writes no order events | Event counter unchanged | RM |

### 6.6 Integration – seating, orders, items, guests

| ID | Case | Expected | Src |
| --- | --- | --- | --- |
| I-SES-01 | Seat a party | 201 + `session.opened`; again → 200, same id, no new event | RM, R2 |
| I-SES-02 | Unknown table | 400 | RM |
| I-SES-03 | List and detail | List holds open sessions only; detail matches `tableSessionDetailsSchema` and has its orders; 404 unknown | RM |
| I-SES-04 | Move to a free table | 200; every order's `tableId` follows; one `session.moved` with `previousTableId` and the open product types; the old table is free again | RM |
| I-SES-05 | Move edge cases | To an occupied table 409; to its own table 200 without an event; to an unknown table 400 | RM |
| I-SES-06 | Clear the table | 409 while an order is unpaid; 200 once all are closed (`closedAt` set, one `session.closed`); repeat 200 without an event; a closed session cannot move (409); the table seats a new party (new id); unknown 404 | RM, R2 |
| I-SES-07 | Clear a session without orders | 200 | RM |
| I-ORD-01 | Order at a free table | 201; seats the party; events `session.opened`, `order.created`; matches `orderSchema`; items start `OPEN`; two of one product = two items | RM, R3, R5 |
| I-ORD-02 | Second order | Joins the same session | RM, R3 |
| I-ORD-03 | Unknown product | 400; no order and no `order.created` | C |
| I-ORD-03b | …side effect | The session opened for it stays open (F7) | Code |
| I-ORD-04 | Unknown table / employee | 400 | C |
| I-ORD-05 | Paging | Newest first; `take`/`skip` slice correctly; `take=201`, `take=0`, `skip=-1` → 400 | RM |
| I-ORD-06 | Default page | Exactly `min(50, total)` rows | RM |
| I-ORD-07 | Reassign | 200 with the employee resolved; `null` unassigns; unknown employee 400; unknown order 404; one `order.updated` each | RM |
| I-ORD-08 | Payment | 409 while items are unserved (message counts them); 200 when all are served (`CLOSED`, `closedAt`); paying again 200, same `closedAt`, no second event; afterwards **every** change to the order or its items → 409 | RM, R7, R11 |
| I-ORD-09 | Empty order | Can be closed (F8) | Code |
| I-ORD-10 | Cancel | 200; items cascade; `order.deleted` carries the items; then 404 | RM |
| I-ORD-11 | Signed-in waiter | Without `employeeId` the waiter is assigned; explicit `null` stays unassigned; an admin is not auto-assigned | Code |
| I-ITM-01 | Add and read | 201 `OPEN` + `item.created`; list oldest first; an item of another order → 404 on get, patch and delete | RM |
| I-ITM-02 | Bad references | Unknown product 400; unknown order 404 (add and list) | RM |
| I-ITM-03 | Transitions through the API | `FOOD OPEN→READY` 409 with the DRINK hint; `DRINK OPEN→SERVED` 200; `SERVED→IN_PROGRESS` 409 listing `READY, REMAKE`; `IN_PROGRESS→REMAKE` 409 | RM, R7 |
| I-ITM-04 | Unchanged and event payload | Re-sending the status → 200, no event; `item.status_changed` carries `previousStatus`, the product type and the order reference with `tableNumber` | RM, R9 |
| I-ITM-05 | Remake | `READY→REMAKE→IN_PROGRESS→READY→SERVED` and `SERVED→REMAKE→SERVED` | RM, K2 |
| I-ITM-06 | `REMAKE` blocks payment | Close → 409 | RM |
| I-ITM-07 | Remove an item | 200 + `item.deleted`; then 404 | RM |
| I-ITM-08 | No shortcut through creation | `status` in the create body is ignored; the item is `OPEN` | C |
| I-GST-01 | Bad QR token | 403 for a wrong token and for another table's token; no party seated | RM, K1 |
| I-GST-02 | Scan | Free table 201 + `sr_guest` cookie with the documented attributes; rescan 200, same session; a party seated by staff is joined | RM, K1 |
| I-GST-03 | `GET /viewer` | Anonymous `null`; guest `{kind: 'guest', tableSessionId, tableId}`; staff `{kind: 'staff', employeeId, role}`; staff login wins over a guest cookie | RM |
| I-GST-04 | Guest order rules | No items 400; `employeeId` 403; another table 409; valid → 201 unassigned; no party seated at the other table | RM |
| I-GST-05 | Guest adds items | To their own open order 201; to another party's order **404** | RM |
| I-GST-06 | Party moved | `/viewer` reports the new table; ordering at the old table 409 naming the new table number; at the new table 201 | RM |
| I-GST-07 | Table cleared | The cookie stops identifying the guest (`/viewer` → `null`); a forged cookie is ignored | RM |
| I-GST-08 | Rescan after clearing | Seats a new party with a new cookie | RM |
| I-GST-09 | …while access control is off | A cleared guest is anonymous and can still order, which seats a new party (F6) | A1 |
| I-EVT-01 | Event log integrity | Every stored event parses with `orderEventSchema`; ids are contiguous; the counter equals the last id | RM |
| I-EVT-02 | Failed requests write nothing | Failed payment, forbidden transition, clearing with unpaid orders, unknown product: counter unchanged | RM |
| I-EVT-03 | Routing fields | `order.created` stores the distinct product types of its items | Code |

### 6.7 Integration – live updates, HTTP layer, database

| ID | Case | Expected | Src |
| --- | --- | --- | --- |
| I-LIV-01 | Snapshot, anonymous | Matches `liveSnapshotSchema`; `cursor` = event counter; exactly the open sessions | RM |
| I-LIV-02 | Snapshot contents | Paid orders of an open session included; after clearing, its orders are gone | RM |
| I-LIV-03 | Snapshot, guest | Own session only; `employeeId` and `employee` null | RM |
| I-LIV-04 | Snapshot, kitchen / bar | Open orders holding station items only, other items removed; the sessions are exactly those of the listed orders | RM, R12, R13 |
| I-LIV-05 | Stream: bad start | No `since` 400; malformed `Last-Event-ID` 400; negative `since` 400 | RM |
| I-LIV-06 | Stream: backlog | Events after `since`, SSE `id` = event id, SSE `event` = type, then `ready` with the cursor | RM |
| I-LIV-07 | Stream: live | A change committed after `ready` arrives with id cursor + 1 | RM |
| I-LIV-08 | Reconnect | `Last-Event-ID` overrides `since` | RM |
| I-LIV-09 | Cursor from the future | `resync cursor_unknown`, then the server closes the stream | RM |
| I-LIV-10 | Pruned history | `resync cursor_expired`, then the server closes the stream | RM |
| I-LIV-11 | Guest stream | Other parties' events invisible; ends after their own `session.closed`; the dead cookie then reads as anonymous (F6) | RM |
| I-LIV-12 | Bar stream | Only the drink `item.created`; no `session.opened`, no order without drinks; ids count hidden events | RM, R13 |
| I-HTTP-01 | Origin check | POST from a foreign origin 403; from `FRONTEND_URL` 201; GET from a foreign origin 200 | RM |
| I-HTTP-02 | CORS | Preflight from the frontend 204 with allow-origin, allow-credentials and `Last-Event-ID` allowed; a foreign origin gets no CORS headers; `Vary: Origin` always | RM |
| I-HTTP-03 | OpenAPI | `/api/docs-json` lists every route, including the auth routes | RM |
| I-HTTP-04 | Unknown route | 404 | – |
| I-HTTP-05 | Malformed JSON | 400 | – |
| I-DB-01 | One open session per table | A second open session for a table is rejected by `Table_Session_one_open_per_table` | RM |
| I-DB-02 | Order follows its session | Changing an order's `table_id` away from its session's table is rejected by the composite foreign key | RM |
| I-DB-03 | Single event counter | A second counter row violates `Order_Event_Counter_single_row` | RM |

### 6.8 Integration – concurrency

Each case runs ten rounds of simultaneous requests and asserts an invariant in
the database, not a fixed winner.

| ID | Race | Invariant | Src |
| --- | --- | --- | --- |
| I-CON-01 | 4 scans / seatings of one free table at once | One session, exactly one 201, exactly one `session.opened` | RM |
| I-CON-02 | Add an item ∥ pay the order | Never an unserved item on a closed order; outcomes are `(201, 409)` or `(409, 200)` | RM |
| I-CON-03 | Place an order ∥ clear the table | No open order in a closed session | RM |
| I-CON-04 | 3 × the same status move | All 200, exactly one `item.status_changed` | RM |
| I-CON-05 | 6 orders on 6 tables at once | 12 events, ids contiguous and in commit order | RM |
| I-CON-06 | Two admins demote each other at once | Exactly one 200 and one 409 | RM |
| I-CON-07 | Delete an order ∥ add an item to it | No orphaned items; when the add won, the delete's response lists both items | RM |

---

## 7. Verification

Each case was checked by running it, not only by reading the code.

### Method

1. **Code trace.** Each expectation was checked against its source (§1) and
   then against the code path that implements it.
2. **Executable probe.** Each case was written as a Vitest test with the
   tooling in §4: the full `AppModule` on PostgreSQL 16, migrated with the
   repository's migrations, against branch `dev/main` at `39e62d3`.
3. **Stability.** The full set ran 5 times in a row without a failure (26 s
   per run).
   The configuration in §4 was trial-run separately: both projects, the global
   setup migrating a fresh `smart_restaurant_test`, and the env override.
4. **Mutation check.** A passing concurrency test proves nothing if it would
   also pass without the protection. Each mutation below removed one guard from
   the source and the run was repeated: the listed tests must fail.

### Results

| Area | Cases (incl. parameterised) | Passed |
| --- | --- | --- |
| Unit – contracts | 146 | 146 |
| Unit – auth | 86 | 86 |
| Unit – services | 49 | 49 |
| Unit – live | 26 | 26 |
| Integration – master data | 30 | 30 |
| Integration – seating, orders, items, guests, events | 39 | 39 |
| Integration – live, HTTP, database | 20 | 20 |
| Integration – concurrency | 7 | 7 |
| **Total** | **403** | **403** |

| Mutation | Caught by |
| --- | --- |
| M1 – `FOR UPDATE` removed from the order and session locks | I-CON-02, -03, -04, -07 |
| M2 – re-sending a status writes anyway | I-ITM-04 |
| M3 – a guest may add to any party's order | I-GST-05 |
| M4 – the losing scan does not join the winning session | I-CON-01 |
| M5 – no advisory lock around the last-admin check | I-CON-06 |
| M6 – the guest snapshot keeps the employee | I-LIV-03 |

### Problems found in the probes, not the backend

The fixes are already in the catalogue and conventions above.

- **V-1** Enum arrays read through node-postgres are strings (`'{FOOD}'`). Two
  probes failed until the query cast to `text[]`.
- **V-2** A first version of I-PRD-01 compared the API's order with JavaScript's
  `sort()`. That passes on the sample data but is unsound in general: the
  database collation decides. Rule: use controlled names.
- **V-3** Random table numbers from `Math.random()` collided in about one run of
  three (409 "already taken"), which made concurrency cases look flaky. Rule:
  unique keys from a counter.

---

## 8. Findings for the team

Behaviour the verified cases pin down, but that the requirements or the docs
read differently. A test encodes the current behaviour where one exists. Each
point needs a decision, not necessarily a code change.

| ID | Finding | Where | Suggested decision |
| --- | --- | --- | --- |
| F1 | R1 says tables seat 2–8; the API accepts any `seats` ≥ 0 and defaults to 0. | U-CT-06, I-TBL-03 | Add `.min(2).max(8)` to the table schemas, or document why not. |
| F2 | R4 wants every order stored with date and time. `Order` has `closedAt` but no creation time; only the session has `openedAt`. "Sorted by arrival" (R12) relies on id order. | – | Add `Order.createdAt` (and maybe `OrderItem.createdAt` for kitchen waiting times, K4). |
| F3 | R9 wants every status change logged **with the employee**. `Order_Event` records time, order and item, but not who acted. With access control off there is no actor to record. | I-EVT-*, I-ITM-04 | Store `employeeId` on the event once logins are enforced. |
| F4 | Statistics (R10), priority and escalation (K4), and stock (K3, K5) are not implemented. | – | Implement, or state the scope reduction (the assignment allows partial implementation). Tests are listed under [pending](#9-pending-tests). |
| F5 | Order total / bill (R11) is not computed by the API; the client adds up `product.price`. | – | Acceptable; a `total` field would make it testable on the server. |
| F6 | With access control off, a guest whose table was cleared becomes an anonymous caller. They can still order (which seats a new party) and still read the full live stream. The README's "the cookie stops working" holds for the guest identity only. | I-GST-09, I-LIV-11 | Expected while A1 holds; re-check when access control returns. |
| F7 | An order that fails validation of its items (unknown product) still leaves the session it opened, so the table shows as occupied. | I-ORD-03b | Validate products before seating, or accept and document. |
| F8 | An order without items can be paid (`close` → 200). | I-ORD-09 | Probably fine (nothing to pay); decide and document. |
| F9 | `PATCH /orders/{id}` accepts any employee as the assignee, including `KITCHEN` and `BAR`. | Code | Restrict to `SERVICE`/`ADMIN` when access control returns. |

---

## 9. Pending tests

These tests can't be written yet. They become due when the feature lands or
access control is switched back on.

| ID | Pending on | Cases |
| --- | --- | --- |
| P-ACC | Access control on again (A1) | For every route, the README role table as a matrix: anonymous 401, guest 401 except the guest routes, each role 200/403. Includes claiming an unassigned order (403 if someone claimed it first) and `SERVICE` updating their own profile without changing the role. |
| P-LOG | F3 | Every event names the acting employee; guest actions name none. |
| P-TIME | F2 | Orders carry a creation time; kitchen and bar lists sort by it. |
| P-STAT | F4 | Weekly revenue per calendar week (only `CLOSED` orders, by `closedAt`); best-selling drink of the week; ties and empty weeks. |
| P-PRIO | F4 | Priority set and adjusted; remake → highest priority; escalation after 10 minutes (fake clock). |
| P-STOCK | F4 | Stock decreases on remake; cannot go negative. |
| P-SEATS | F1 | `seats` 1 and 9 rejected; 2 and 8 accepted. |

---

## 10. Rollout

| Step | Content | Exit criterion |
| --- | --- | --- |
| 0 | Dependencies, `vitest.config.ts`, `configureApp()` refactor, `.env.test`, global setup, support helpers | `pnpm nx test backend` runs an empty suite green |
| 1 | Unit tests §6.1–6.4 | 307 cases green, no database needed |
| 2 | Integration §6.5–6.6 | Master data and workflow green against the test DB |
| 3 | Integration §6.7–6.8 | Live, HTTP, DB constraints and concurrency green; 5 consecutive green runs |
| 4 | CI workflow (when the repository gets one) | Unit on every push; integration with a Postgres service |
| 5 | Pending tests §9 | As features land |

The verified probes from §7 can be turned into the suite in steps 1–3. Their
case IDs match this catalogue one to one.

For the Schritt 6 hand-in (*Testdokumentation*), §2 is the requirements
coverage, §6 the test cases, and §7 the test protocol.
