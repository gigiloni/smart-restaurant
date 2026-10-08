# Backend tests – plan and documentation

Scope: the `backend` (NestJS/Fastify/Prisma) and the parts of `contracts` it
enforces. Unit and integration tests only. The frontend team sets up its own
tests; browser end-to-end tests and load tests are out of scope here.

Status: **implemented**. The suite in `backend/` and `contracts/` has **485
test cases, all passing** (149 contracts, 219 backend unit, 117 backend
integration). This document started as the plan for that suite and now
records what it covers, how it was verified, and what it found. The full list
of cases is [Appendix A](#appendix-a-test-catalogue), generated from a test run.

## Contents

1. [Sources](#1-sources)
2. [Requirements traceability](#2-requirements-traceability)
3. [Strategy](#3-strategy)
4. [Tooling and setup](#4-tooling-and-setup)
5. [Conventions](#5-conventions)
6. [What is covered](#6-what-is-covered)
7. [Verification](#7-verification)
8. [Findings for the team](#8-findings-for-the-team)
9. [Pending tests](#9-pending-tests)
10. [Status and next steps](#10-status-and-next-steps)
11. [Appendix A: test catalogue](#appendix-a-test-catalogue)

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
  dedicated, disposable PostgreSQL database next to the development one, never
  the development database itself.

---

## 2. Requirements traceability

Status: ✅ implemented and covered · ⚠️ partly implemented · ❌ not implemented
(no test possible yet, see [Findings](#8-findings-for-the-team)). A case is
named by its group and number: I-TBL-03 is case `03` in group `I-TBL`
([Appendix A](#appendix-a-test-catalogue)).

| ID | Requirement (Projektauftrag) | Status | Test cases |
| --- | --- | --- | --- |
| R1 | Tables with a unique table number and 2–8 seats | ⚠️ unique ✅, seat range not enforced (F1) | I-TBL-03…05, U-CT-06 |
| R2 | Table status free / occupied | ✅ occupied = an open table session | I-SES-01, I-SES-06…07, I-DB-01, I-CON-01, I-ORD-03 |
| R3 | A table can place several orders | ✅ | I-ORD-02 |
| R4 | An order is stored with date and time | ❌ orders have no creation time (F2) | – |
| R5 | Order items with article and quantity | ✅ quantity = repeated items (A2) | I-ORD-01, I-ITM-01 |
| R6 | Article: name, price, category; the category routes it to kitchen or bar | ✅ | U-CT-07, I-PRD-04, U-LS-06…08, U-EVW-03…05, I-LIV-04, I-LIV-12…13 |
| R7 | Status chain placed → in progress → ready → served → paid | ✅ (A3) | U-CT-01, U-CT-02, U-SV-ITM-*, I-ITM-03…06, I-ORD-08 |
| R8 | Employees with name, username, role (≥ Service, Kitchen, Bar, Admin) | ✅ username = login email | U-CT-08, I-EMP-01…02, I-EMP-12 |
| R9 | Every status change logged with employee, timestamp, order | ⚠️ logged with timestamp and order, not the employee (F3) | U-EVW-*, I-EVT-01…03, I-ITM-04 |
| R10 | Statistics: weekly revenue, best-selling drink | ❌ (F4) | – |
| R11 | Service: choose table, enter order, mark served, show bill, close order | ✅ (bill = the order with its items and prices) | I-SES-*, I-ORD-*, I-ITM-03…05 |
| R12 | Kitchen: kitchen orders sorted by arrival; set in progress / ready | ✅ arrival = order id; role check dormant (A1) | I-LIV-04, I-LIV-13, U-SV-ITM-*, U-AC-06 |
| R13 | Bar: drink orders, open ones first | ✅ the bar sees open orders only | I-LIV-04, I-LIV-12 |
| R14 | Admin: CRUD for employees, articles, tables | ✅ | I-EMP-*, I-PRD-*, I-ING-*, I-TBL-* |
| K1 | Guests sign in with the table code; menu and cart | ✅ QR token, cart = `products-by-id` | I-GST-*, I-PRD-02…03, I-LIV-11, U-GA-* |
| K2 | Remake sends the item back to the kitchen | ✅ | U-CT-01, I-ITM-05…06 |
| K3 | Remake also takes the item out of stock | ❌ no stock (F4) | – |
| K4 | Priority, adjustable, escalating after 10 minutes | ❌ (F4) | – |
| K5 | Stock management, monitoring (revenue, best sellers, staff statistics) | ❌ (F4) | – |
| K6 | Several roles with authentication and authorization | ⚠️ implemented, switched off (A1, F6) | U-AC-*, U-AG-*, U-VR-*, I-AUTH-*, I-EMP-02…03, I-EMP-09, I-GST-03 |

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
| **Vitest + `unplugin-swc`** | ✅ Chosen. Native ESM; the backend is `"type": "module"` with `NodeNext` imports. SWC emits the decorator metadata that Nest's dependency injection needs, which Vitest's default compiler (esbuild) does not. |
| Jest + `ts-jest` | ❌ ESM support is still experimental, and the `.js` import suffixes of `NodeNext` need extra mapping. |
| `node:test` + `tsx` | ❌ esbuild emits no `emitDecoratorMetadata`, so `AppModule` cannot be built: constructor injection breaks. |

Development dependencies: `vitest`, `unplugin-swc`, `@swc/core`,
`@nestjs/testing`. `pnpm-workspace.yaml` allows the `@swc/core` install
script; pnpm 11 rejects the install otherwise.

### Commands

| Command | Runs | Needs |
| --- | --- | --- |
| `pnpm test` | Everything below | PostgreSQL |
| `pnpm nx test contracts` | Unit tests of the shared rules and schemas | nothing |
| `pnpm nx run backend:test-unit` | Backend unit tests | nothing |
| `pnpm nx run backend:test-integration` | The API over HTTP on a real database | PostgreSQL |
| `pnpm nx run backend:typecheck` | Type-checks the test code, which Vitest does not | nothing |

### Where things are

| File | Purpose |
| --- | --- |
| `backend/vitest.config.ts` | Two projects: `unit` (`src/**/*.spec.ts`) and `integration` (`test/**/*.int-spec.ts`, files one at a time). Resolves `@smart-restaurant/contracts` to its source. |
| `contracts/vitest.config.ts` | The contracts' own unit tests. |
| `backend/src/app/configure-app.ts` | Everything `main.ts` sets up besides the modules (prefix, CORS, validation, Swagger, auth routes). Integration tests build the app through it, so they test what is deployed. |
| `backend/test/support/env.ts` | The test environment. The database is the server, user and password of the developer's `DATABASE_URL` (environment, root `.env` or `backend/.env`) with `_test` appended to its name, unless `TEST_DATABASE_URL` is set. Refuses a database whose name does not end in `_test`. |
| `backend/test/global-setup.ts` | Once per run: creates the test database if missing, takes a run lock (a second run waits instead of wiping the database under the first), and runs `prisma migrate deploy`. |
| `backend/test/support/database.ts` | Empties every table at the start of each file; raw SQL and event-log helpers for assertions. |
| `backend/test/support/app.ts`, `context.ts`, `http.ts`, `fixtures.ts`, `sse.ts` | The app per file, an `app.inject()` client, test data built through the API, and an SSE reader that waits for `ready` before a change is made. |
| `backend/test/support/unit.ts` | `withTransactions()`: builds a service with the `nestjs-cls` no-op transactional adapter, so `@Transactional()` methods run in unit tests; `prismaError()`, `stub()`. |
| `backend/tsconfig.spec.json` | Type-checks the tests (`typecheck` target). |

---

## 5. Conventions

- **Layout.** Unit tests sit next to the code they test (`orders.service.spec.ts`).
  Integration tests are `backend/test/*.int-spec.ts`.
- **IDs.** Each group carries an ID (`I-ORD`: integration, orders) and each
  case a number within it (`08 takes payment once everything is served…`).
- **Every case builds its own data** through the API and passes when run
  alone (`vitest run -t …`). Unique keys come from a counter, never from
  `Math.random()`.
- **Assert the side effect, not only the status**: the row, the cascade, or
  the event in `Order_Event`. Assert the status of a request that is meant to
  fail, so it cannot fail for the wrong reason.
- **Validate responses with the contract schemas** (`orderSchema.parse(body)`).
- **Pitfalls found while building the suite:**
  - node-postgres returns Postgres enum arrays as the raw string `'{FOOD}'`;
    cast in SQL (`product_types::text[]`). `bigint` ids come back as strings;
    cast with `::int`.
  - Match database errors by SQL state and constraint name, not by message:
    the message is translated with the server's locale.
  - Don't compare an API sort with JavaScript's `sort()` on arbitrary names:
    the database collation decides. Use controlled names.
  - SSE needs a real socket (`app.listen({ port: 0 })`). Wait for `ready`
    before changing anything the test expects to see live; a change made
    earlier arrives as backlog.
  - Better Auth turns its origin and CSRF checks off under test (it detects
    Vitest). The app now keeps them on (F11); session requests in tests send
    the frontend's `Origin`, as browsers do.
  - Prices come back as decimal strings without padding: `3.5` is `"3.5"`.

---

## 6. What is covered

| Area | Level | Groups | Cases | What the cases check |
| --- | --- | --- | --- | --- |
| Shared rules and payloads | unit | U-CT-01…10 | 149 | The status-transition table (5 × 5 × 3, against the README), every schema boundary (ids, paging, product ids, tables, products, employees, ingredients, orders, guests, live). |
| Access rules (dormant) | unit | U-AC | 70 | The README role table: admin, own profile, role changes, order ownership, role × product type × status (60 cases). |
| Login and guests | unit | U-AG, U-GA, U-VR | 21 | Origin check, login requirement, QR tokens and guest cookies (forged, expired, swapped), who a request comes from. |
| Services | unit | U-SV-* | 70 | Error mapping (409/400/404), idempotent no-ops, the retry when a table is cleared mid-order, the seating race, what reaches the repository and the event log. |
| Live updates and event log | unit | U-LS, U-LST, U-FD, U-EVW, U-RL | 46 | Who sees which event, catch-up and resync, heartbeat and re-validation, paging, events and row locks only inside a transaction. |
| Infrastructure | unit | U-ENV, U-CORS | 12 | Environment validation, CORS headers and preflights. |
| Master data | integration | I-TBL, I-EMP, I-ING, I-PRD | 34 | CRUD, uniqueness, validation, 404s, delete rules, recipes, the last active admin, logins. |
| Seating, orders, items, guests | integration | I-SES, I-ORD, I-ITM, I-GST, I-EVT | 43 | The lifecycles in the README: seating, moving, clearing, payment, the item chain, guest rules, and one event per change, none for a failed request. |
| Live updates | integration | I-LIV | 15 | Snapshots per viewer, the stream over a socket (backlog, resync, privacy for guests, kitchen and bar), CORS on the stream, pruning after 24 hours. |
| HTTP, auth, database, seed | integration | I-HTTP, I-AUTH, I-DB, I-SEED | 18 | Origin check and CORS, OpenAPI, auth routes, the constraints the code relies on, the sample data loading on the migrated schema. |
| Concurrency | integration | I-CON | 7 | Ten rounds of simultaneous requests each; invariants in the database, not a fixed winner. |

The exact cases are listed in [Appendix A](#appendix-a-test-catalogue).

---

## 7. Verification

The suite was checked for soundness, not only run:

| Check | Result |
| --- | --- |
| Full runs | All 485 cases pass, repeatedly, from `pnpm test` (about 1 minute). |
| Isolation | Each of the 117 integration cases passes when run on its own. |
| Mutation checks | For 16 guards in the code, the guard was removed and the matching tests had to fail. All 16 were caught (below). |
| Independent reviews | Two separate reviews of the unit and the integration tests; every finding was verified and fixed. |
| Coverage | About 95 % of backend lines and 90 % of branches. Uncovered lines are mostly re-thrown database errors and reconnect paths. |
| Database setups | Root `.env` only, `backend/.env` only, both disagreeing, a user other than `admin`, a role that may not log in, a user without `CREATEDB`, and two runs at once. |
| Static checks | Lint without new warnings; the build and the test type-check pass. |

| Guard removed | Caught by |
| --- | --- |
| `FOR UPDATE` on order and session locks | I-CON-02, -03, -04, -07 |
| Re-sending a status is a no-op | I-ITM-04 |
| A guest only reaches their own party's orders | I-GST-05, U-SV-ITM-09 |
| The losing scan joins the winning session | I-CON-01 |
| Advisory lock around the last-admin check | I-CON-06 |
| Guests never see who served them (snapshot, events) | I-LIV-03, U-LS (order.updated) |
| References checked before seating | I-ORD-03 |
| Better Auth origin check kept on | I-AUTH-04 |
| Table token and cookie MACs kept apart | U-GA-06…08 |
| Backlog and feed read page by page | U-LST-01, U-FD-01 |
| Status written only if unchanged since the check | U-SV-ITM-05 |
| Kitchen sees open orders only | I-LIV-04 |
| Event log pruned as a prefix, not by time | I-LIV-15 |

### Problems found in the tests along the way

Fixed, and turned into the conventions in §5: enum arrays read as strings,
sorting compared with JavaScript instead of the collation, colliding random
keys, cases that only passed after the cases before them, a fixed pause
before SSE assertions, assertions on locale-dependent error messages,
checks that could not fail (a forged cookie tried on a closed session, an
exclusion tested with nothing to exclude), and a test setup that ignored the
developer's database settings.

---

## 8. Findings for the team

Behaviour the suite pins down, compared with the requirements and the docs.

| ID | Finding | Status |
| --- | --- | --- |
| F1 | R1 says tables seat 2–8; the API accepts any `seats` ≥ 0 and defaults to 0 (U-CT-06). | Open: add the range to the table schemas, or document why not. |
| F2 | R4 wants every order stored with date and time. `Order` has `closedAt` but no creation time; "sorted by arrival" relies on id order. | Open: add `Order.createdAt` (and `OrderItem.createdAt` for waiting times, K4). |
| F3 | R9 wants every status change logged with the employee. `Order_Event` records time, order and item, not who acted. | Open: store the actor once logins are enforced. |
| F4 | Statistics (R10), priority and escalation (K4), stock (K3, K5) are not implemented. | Open: implement, or state the scope reduction. |
| F5 | The bill (R11) is not computed by the API; the client adds up `product.price`. | Open; acceptable. |
| F6 | With access control off, a guest whose table was cleared becomes anonymous: they can still order and read the full live stream (I-GST-09, I-LIV-11). | Expected while A1 holds. |
| F7 | An order refused for an unknown product or employee still seated the party and wrote `session.opened`. | **Fixed**: references are checked before seating (I-ORD-03). |
| F8 | An order without items can be paid (I-ORD-09). | Open: probably fine; decide and document. |
| F9 | `PATCH /orders/{id}` accepts any employee as assignee, including kitchen and bar. | Open: restrict when access control returns. |
| F10 | Orders, session details, snapshots and stored events carried the employee's Better Auth user id. | **Fixed**: only the public employee fields are embedded (I-ORD-07, I-EVT-01). |
| F11 | Better Auth skipped its origin and CSRF checks under test, so the tests ran with weaker protection than production. | **Fixed**: the check stays on everywhere (I-AUTH-04). |
| F12 | `FRONTEND_URL=localhost:4200` (no scheme) passes the environment check, but CORS then never matches. | Open: require `http(s)://` in the schema. |
| F13 | Prisma's Postgres adapter warns about overlapping queries inside transactions. | Open: production code, not the tests. |

---

## 9. Pending tests

Due when the feature lands or access control is switched back on.

| ID | Pending on | Cases |
| --- | --- | --- |
| P-ACC | Access control on again (A1) | For every route, the README role table as a matrix: anonymous 401, guest 401 except the guest routes, each role 200/403; claiming an unassigned order; `SERVICE` editing their own profile but not their role. |
| P-LOG | F3 | Every event names the acting employee; guest actions name none. |
| P-TIME | F2 | Orders carry a creation time; kitchen and bar lists sort by it. |
| P-STAT | F4 | Weekly revenue (only `CLOSED` orders, by `closedAt`); best-selling drink of the week; ties and empty weeks. |
| P-PRIO | F4 | Priority set and adjusted; remake → highest priority; escalation after 10 minutes (fake clock). |
| P-STOCK | F4 | Stock decreases on remake; cannot go negative. |
| P-SEATS | F1 | `seats` 1 and 9 rejected; 2 and 8 accepted. |

---

## 10. Status and next steps

| Step | Content | Status |
| --- | --- | --- |
| 0 | Dependencies, Vitest configs, `configureApp()`, test database setup, helpers | ✅ done |
| 1 | Unit tests | ✅ 368 cases (149 contracts, 219 backend) |
| 2 | Integration: master data, lifecycles, guests, events | ✅ |
| 3 | Integration: live updates, HTTP, auth, database, seed, concurrency | ✅ 117 integration cases in all |
| 4 | CI workflow (the repository has none yet) | Open: unit tests on every push; integration with a `postgres:18-alpine` service |
| 5 | Pending tests (§9) | As features land |

For the Schritt 6 hand-in (*Testdokumentation*): §2 is the requirements
coverage, §6 and Appendix A the test cases, §7 the test protocol, §8 the
results.

---

## Appendix A: test catalogue

Every case of the suite, generated from a run of `pnpm test` with Vitest's
JSON reporter on 2026-10-08: 485 cases, all passed. Parameterised groups with
more than 20 cases are shown as one row.

### A.1 Unit – contracts (149 cases)

#### `contracts/src/lib/common/common.spec.ts` (14)

| Group | Case |
| --- | --- |
| U-CT-03 idParamSchema | coerces a path string to a number |
|  | accepts the largest int4 |
|  | rejects "0" |
|  | rejects "-1" |
|  | rejects "1.5" |
|  | rejects "abc" |
|  | rejects "" |
|  | rejects "2147483648" |
| U-CT-04 paginationQuerySchema | defaults to the newest 50 |
|  | accepts the 200 cap |
|  | rejects {"take":"201"} |
|  | rejects {"take":"0"} |
|  | rejects {"skip":"-1"} |
|  | rejects {"take":"x"} |

#### `contracts/src/lib/employees/employees.spec.ts` (6)

| Group | Case |
| --- | --- |
| U-CT-08 employee payloads | accepts passwords of 12 to 128 characters |
|  | rejects an 11-character password |
|  | rejects a 129-character password |
|  | rejects an invalid email |
|  | requires a role on create |
|  | rejects an unknown role and an empty update |

#### `contracts/src/lib/ingredients/ingredients.spec.ts` (5)

| Group | Case |
| --- | --- |
| U-CT-10 ingredient payloads | trims the name |
|  | rejects {"name":"   "} |
|  | rejects {"name":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"} |
|  | rejects {} |
|  | rejects an empty update |

#### `contracts/src/lib/order-items/order-item-transitions.spec.ts` (84)

| Group | Case |
| --- | --- |
| U-CT-01 classifyOrderItemTransition matches the README table | 75 parameterised cases, e.g. “FOOD OPEN -> OPEN is unchanged”, “DRINK REMAKE -> REMAKE is unchanged” |
| U-CT-02 permittedOrderItemTargets | lets FOOD only step forward from OPEN |
|  | lets DRINK skip ahead from OPEN |
|  | allows undo, forward and send-back from READY |
|  | resolves REMAKE to a remake or keep |
|  | never lists the current status OPEN as a move |
|  | never lists the current status IN_PROGRESS as a move |
|  | never lists the current status READY as a move |
|  | never lists the current status SERVED as a move |
|  | never lists the current status REMAKE as a move |

#### `contracts/src/lib/orders/orders.spec.ts` (8)

| Group | Case |
| --- | --- |
| U-CT-09 orders, items, guests and the live stream | makes employeeId optional and nullable on create |
|  | accepts an empty items array |
|  | requires tableId |
|  | requires the employeeId key on update |
|  | drops a status sent with a new item, so items always start OPEN |
|  | rejects an unknown item status |
|  | bounds the QR token to 1-200 characters |
|  | coerces since and rejects negatives |

#### `contracts/src/lib/products/products.spec.ts` (25)

| Group | Case |
| --- | --- |
| U-CT-05 product ids in the query string | reads a comma-separated list |
|  | reads repeated parameters |
|  | reads a mix of both and drops duplicates |
|  | leaves ids out when the parameter is absent |
|  | accepts 100 ids and rejects 101 |
|  | rejects "" |
|  | rejects "abc" |
|  | rejects "1,,2" |
|  | rejects "0" |
| U-CT-05 product ids in a JSON body | drops duplicates |
|  | counts the limit before dropping duplicates |
|  | rejects {"ids":[]} |
|  | rejects {"ids":["1"]} |
|  | rejects {"ids":[1.5]} |
|  | rejects {} |
| U-CT-07 product payloads | trims the name |
|  | accepts a free product and a null description |
|  | rejects a blank name |
|  | rejects a name over 100 characters |
|  | rejects a negative price |
|  | rejects an unknown type |
|  | rejects a description over 100 characters |
|  | rejects an ingredient listed twice |
|  | defaults a recipe amount to 0 |
|  | rejects an empty update but accepts clearing the recipe |

#### `contracts/src/lib/tables/tables.spec.ts` (7)

| Group | Case |
| --- | --- |
| U-CT-06 table payloads | defaults seats to 0 |
|  | rejects {"tableNumber":0} |
|  | rejects {"tableNumber":1,"seats":-1} |
|  | rejects {"tableNumber":1.5} |
|  | rejects {} |
|  | rejects an empty update |
|  | accepts any non-negative seat count (no 2-8 range yet) |

### A.2 Unit – backend (219 cases)

#### `backend/src/auth/access.service.spec.ts` (70)

| Group | Case |
| --- | --- |
| U-AC-01 requireAdmin | lets admins through |
|  | forbids SERVICE |
|  | forbids KITCHEN |
|  | forbids BAR |
| U-AC-02 requireEmployee | allows the own profile and admins, forbids others |
| U-AC-03 requireEmployeeUpdate | lets staff edit their profile but not their role |
| U-AC-04 requireService | allows SERVICE and ADMIN only |
| U-AC-05 requireOrderOwner | lets any waiter look after an unassigned order |
|  | keeps an assigned order to its waiter and admins |
|  | never lets kitchen or bar own an order |
| U-AC-06 requireStatusChange | 60 parameterised cases, e.g. “ADMIN sets FOOD to OPEN: true”, “BAR sets DRINK to REMAKE: false” |

#### `backend/src/auth/auth.guard.spec.ts` (9)

| Group | Case |
| --- | --- |
| U-AG-01..05 origin check | lets anonymous callers use public routes |
|  | rejects a state-changing request from a foreign origin |
|  | accepts the frontend and the API origin |
|  | lets reads from any origin through |
|  | compares origins, not configured URLs |
| U-AG-06..09 login requirement | turns anonymous callers and guests away from @RequireLogin() |
|  | lets guests through @RequireLogin({ guests: true }) |
|  | lets staff through either requirement |
|  | puts the caller on the request |

#### `backend/src/auth/guest-access.service.spec.ts` (8)

| Group | Case |
| --- | --- |
| U-GA-01..03 table tokens | are deterministic and differ per table |
|  | depend on the secret |
|  | verify only the table's own token |
| U-GA-04..05 guest cookie | is HTTP-only, SameSite=Lax and lasts 12 hours |
|  | is Secure only behind https |
| U-GA-06..08 resolving the cookie | names the guest of an open session |
|  | stops working once the session is closed or gone |
|  | rejects malformed and forged cookies without touching the database |

#### `backend/src/auth/viewer-resolver.service.spec.ts` (4)

| Group | Case |
| --- | --- |
| U-VR-01..04 ViewerResolver | prefers a staff login over a guest cookie |
|  | falls back to the guest cookie |
|  | ignores guests when they are not allowed |
|  | treats a login without an employee as anonymous |

#### `backend/src/config/env.schema.spec.ts` (8)

| Group | Case |
| --- | --- |
| U-ENV environment schema | 01 fills in the defaults |
|  | 02 treats FRONTEND_URL as optional |
|  | 03 rejects a secret under 32 characters |
|  | 03 rejects a missing database URL |
|  | 03 rejects an auth URL that is not a URL |
|  | 03 rejects a frontend URL that is not a URL |
|  | 03 rejects an unknown NODE_ENV |
|  | 03 rejects a port that is not a positive integer |

#### `backend/src/cors.spec.ts` (4)

| Group | Case |
| --- | --- |
| U-CORS enableCors | 01 allows the configured origin with credentials |
|  | 02 gives other origins no CORS headers, only Vary |
|  | 03 matches by origin, so a configured trailing slash or path does not matter |
|  | 04 answers a preflight itself with 204 |

#### `backend/src/employees/employees.service.spec.ts` (6)

| Group | Case |
| --- | --- |
| U-SV-EMP EmployeesService | 01 maps a taken email to 409 |
|  | 02 refuses a second login for the same employee |
|  | 03 answers 404 when adding a login to an unknown employee |
|  | 04 maps an employee with orders on delete to 409 |
|  | 05 passes the repository's conflicts through unchanged |
|  | 06 maps a taken email to 409 when adding a login |

#### `backend/src/ingredients/ingredients.service.spec.ts` (2)

| Group | Case |
| --- | --- |
| U-SV-ING IngredientsService | 01 maps an ingredient used in a recipe on delete to 409 |
|  | 02 answers 404 for an unknown ingredient, and does not attempt a write |

#### `backend/src/live/live-scope.spec.ts` (17)

| Group | Case |
| --- | --- |
| U-LS-01 stationProductTypes | limits kitchen and bar to their products |
|  | does not limit anyone else by product type |
| U-LS-02..05 everyone but the stations | shows anonymous callers, service and admin every event unchanged |
|  | shows a guest their own session only |
|  | never tells a guest who served them (order.created) |
|  | never tells a guest who served them (order.updated) |
|  | never tells a guest who served them (order.closed) |
|  | never tells a guest who served them (order.deleted) |
|  | tells a guest their table was cleared |
| U-LS-06..08 kitchen and bar | route item events by product type |
|  | see orders with their items only (order.created) |
|  | see orders with their items only (order.updated) |
|  | see orders with their items only (order.closed) |
|  | see orders with their items only (order.deleted) |
|  | never see tables opened or cleared, and moves only when they matter |
| U-LS-09..10 purity | never changes the logged event, which every client shares |
|  | onlyStationItems keeps the station items |

#### `backend/src/live/live-stream.spec.ts` (15)

| Group | Case |
| --- | --- |
| U-LST live stream | 01 sends the backlog in order, page by page, then ready with the cursor |
|  | 02 asks for a resync when the cursor is ahead of the log |
|  | 03 asks for a resync when the oldest missed events have been pruned |
|  | 03b asks for a resync when the newest missed events are missing from the log |
|  | 04 holds live events during catch-up and drops duplicates |
|  | 05 asks for a resync on a gap in the live feed |
|  | 06 moves the cursor past events the viewer may not see |
|  | 07 resyncs on a log reset and simply ends on shutdown |
|  | 08 ends a guest's stream after their table is cleared |
|  | 09 sends a heartbeat comment every 15 seconds |
|  | 10 re-checks the login every minute |
|  | 10b keeps the stream open while the login or seat is unchanged |
|  | 10c asks a guest to resync when their cookie names another session |
|  | 11 stops its timers and leaves the feed when unsubscribed |
|  | 12 fails the stream when the log cannot be read |

#### `backend/src/live/order-event-feed.service.spec.ts` (6)

| Group | Case |
| --- | --- |
| U-FD OrderEventFeed | 01 publishes new events in order, page by page, and remembers how far it got |
|  | 02 resets every client when the log went backwards |
|  | 03 resets every client on a gap, then continues from the head |
|  | 04 folds pokes during a read into one more read |
|  | 05 logs a failed read and reads again on the next poke |
|  | 06 tells every stream it is shutting down, and stops reading |

#### `backend/src/order-events/order-events.writer.spec.ts` (8)

| Group | Case |
| --- | --- |
| U-EVW OrderEventsWriter | 01 refuses to write an event outside a transaction |
|  | 02 numbers the event from the counter and notifies listeners |
|  | 03 stores the distinct product types of an order, for kitchen and bar |
|  | 04 stores an item event with its product type and a reference to its order |
|  | 05 stores a move with the table left and the open orders' product types |
|  | 06 stores dates as the API returns them, as ISO strings |
| U-RL RowLocks | 01 refuses to lock outside a transaction, where the lock would protect nothing |
|  | 02 returns the locked row, or null when there is none |

#### `backend/src/order-items/order-items.service.spec.ts` (12)

| Group | Case |
| --- | --- |
| U-SV-ITM status changes | 01 refuses a forbidden move with 409, naming the permitted moves and why a skip is refused |
|  | 02 gives no DRINK hint when the product type is not the reason |
|  | 03 accepts the current status without writing anything |
|  | 04 reports a lost race on the status with 409 |
|  | 05 writes only while the item still has the status it was checked against, and records the move |
|  | 06 answers 404 for an item that is not on the order |
|  | 08 moves items without an ownership check |
| U-SV-ITM adding and removing items | 07 maps an unknown product to 400 |
|  | 09 locks the order with the guest's party, then adds and records the item |
|  | 10 adds nothing when the order may not be changed |
|  | 11 removes an item of the order and records it |
|  | 12 answers 404 when removing an item that is not on the order |

#### `backend/src/orders/order-lock.spec.ts` (7)

| Group | Case |
| --- | --- |
| U-SV-LCK OrderLock.forChange | 01 answers 404 for an unknown order |
|  | 02 hides another party's order from a guest (404, not 403) |
|  | 02b lets a guest change their own party's order |
|  | 03 forbids a waiter who does not own the order |
|  | 04 refuses changes to a paid order |
|  | 05 lets a paid order through when asked to |
|  | 06 checks ownership before the order status |

#### `backend/src/orders/orders.service.spec.ts` (19)

| Group | Case |
| --- | --- |
| U-SV-ORD-01..05 guest orders | 01 refuses to let a guest assign an employee |
|  | 02 needs at least one item (items: undefined) |
|  | 02 needs at least one item (items: undefined) |
|  | 03 tells a moved party where they are seated now, and places nothing |
|  | 04 refuses an order once the table is cleared, and places nothing |
|  | 04 refuses an order once the table is gone, and places nothing |
|  | 05 places an unassigned order in the guest's session and records it |
| U-SV-ORD-06..08 staff orders | 06 seats the next party when the table is cleared in between |
|  | 07 gives up with 409 after the table is cleared twice |
|  | 08 maps an unknown reference (P2003) to 400 |
|  | 08 maps an unknown reference (P2025) to 400 |
| U-SV-ORD-15 checking references before seating | 15 seats nobody when the employee or a product is unknown |
|  | 15b checks nothing it was not given |
| U-SV-ORD-09..12 payment and reassignment | 09 refuses payment while items are unserved, without an event |
|  | 10 treats paying a paid order as a no-op |
|  | 11 closes a fully served order and records it |
|  | 12 maps an unknown employee on reassignment to 400 |
| U-SV-ORD-13..14 reassigning and cancelling | 13 locks the order for the caller, then updates and records it |
|  | 14 deletes the order and records it with its items |

#### `backend/src/products/products.service.spec.ts` (5)

| Group | Case |
| --- | --- |
| U-SV-PRD ProductsService | 01 maps an unknown ingredient (P2003) to 400 |
|  | 01 maps an unknown ingredient (P2025) to 400 |
|  | 02 maps an ordered product on delete to 409 |
|  | 03 passes the requested ids to the repository |
|  | 04 answers 404 for an unknown product, and does not attempt an update |

#### `backend/src/table-sessions/table-sessions.service.spec.ts` (14)

| Group | Case |
| --- | --- |
| U-SV-SES TableSessionsService | 01 joins the party already seated, without an event |
|  | 02 seats a new party at a free table and records it |
|  | 03 joins the winner when two scans race |
|  | 04 maps an unknown table to 400 |
|  | 05 refuses a move to an occupied table |
|  | 06 refuses to move a cleared party and answers 404 for an unknown one |
|  | 07 treats a move to the same table as a no-op |
|  | 08 keeps the table while orders are unpaid |
|  | 09 treats clearing a cleared table as a no-op |
|  | 10 moves the party and records the table it left |
|  | 11 maps a move to an unknown table to 400 |
|  | 12 clears a table whose orders are all paid, and records it |
|  | 13 answers 404 when clearing an unknown session |
|  | 14 rethrows an insert conflict when no winning session can be found |

#### `backend/src/tables/tables.service.spec.ts` (5)

| Group | Case |
| --- | --- |
| U-SV-TBL TablesService | 01 answers 404 for an unknown table |
|  | 02 maps a duplicate table number to 409 |
|  | 03 does not attempt to update an unknown table |
|  | 04 maps a referenced table on delete to 409 |
|  | 05 rethrows anything else unchanged |

### A.3 Integration – backend (117 cases)

#### `backend/test/tables.int-spec.ts` (9)

| Group | Case |
| --- | --- |
| I-TBL tables | 01 lists tables sorted by number |
|  | 02 answers 404 for an unknown table and 400 for a malformed id |
|  | 03 creates a table with 0 seats unless told otherwise |
|  | 04 keeps table numbers unique |
|  | 05 updates the fields sent and rejects an empty update |
|  | 06 deletes an unused table and returns it |
|  | 07 keeps a table that has seated a party |
|  | 08 hands out the QR code content |
|  | 09 ignores fields that are not part of the payload |

#### `backend/test/employees.int-spec.ts` (12)

| Group | Case |
| --- | --- |
| I-EMP employees | 01 lists staff by family name, then given name, without login details |
|  | 02 creates an employee who can sign in; emails are unique regardless of case |
|  | 03 refuses a wrong password |
|  | 04 validates the payload |
|  | 05 adds a login to an employee who has none, once |
|  | 06 never lets the last active admin go |
|  | 07 keeps employees who took orders, and deletes the login with the employee |
|  | 08 renames the employee's login too |
|  | 09 answers /employees/me for signed-in staff only |
|  | 10 returns one employee or 404 |
|  | 11 signs out |
|  | 12 answers 404 for unknown employees and 400 for invalid updates |

#### `backend/test/products.int-spec.ts` (13)

| Group | Case |
| --- | --- |
| I-ING ingredients | 01 creates, lists by name, updates and deletes |
|  | 03 answers 404 for unknown ingredients and 400 for an empty update |
|  | 02 keeps an ingredient a recipe uses |
| I-PRD products | 01 lists products by name with their recipes |
|  | 02 narrows the list with ?ids= |
|  | 03 looks products up by id with POST /products-by-id |
|  | 04 creates a product with its recipe |
|  | 05 rejects an unknown or repeated ingredient and creates nothing |
|  | 06 replaces the recipe only when ingredients are sent |
|  | 07 leaves the recipe alone when a replacement fails |
|  | 08 deletes the recipe with the product, but keeps ordered products |
|  | 09 writes no order events for menu changes |
|  | 10 answers 404 for unknown products and 400 for too many ids |

#### `backend/test/table-sessions.int-spec.ts` (7)

| Group | Case |
| --- | --- |
| I-SES table sessions | 01 seats a party once and joins it afterwards |
|  | 02 answers 400 for an unknown table |
|  | 03 lists seated parties and shows one with its orders |
|  | 04 moves a party with all its orders to a free table |
|  | 05 refuses a move to an occupied or unknown table and ignores a move to the same table |
|  | 06 clears the table only once every order is paid |
|  | 07 clears a table where nobody ordered |

#### `backend/test/orders.int-spec.ts` (13)

| Group | Case |
| --- | --- |
| I-ORD orders | 01 seats the party with the first order at a free table |
|  | 02 adds further orders to the same party |
|  | 03 places nothing and seats nobody when a product is unknown |
|  | 03 places nothing and seats nobody when an employee is unknown |
|  | 04 answers 400 for an unknown table |
|  | 05 pages through orders newest first |
|  | 06 returns 50 orders unless asked for another page size |
|  | 07 reassigns and unassigns an order |
|  | 08 takes payment once everything is served, and freezes the order |
|  | 09 lets an order without items be closed |
|  | 10 cancels an open order with its items |
|  | 11 assigns a signed-in waiter who names nobody |
|  | 12 answers 404 for an unknown order |

#### `backend/test/order-items.int-spec.ts` (8)

| Group | Case |
| --- | --- |
| I-ITM order items | 01 adds items and keeps them to their own order |
|  | 02 answers 400 for an unknown product and 404 for an unknown order |
|  | 03 enforces the status rules |
|  | 04 accepts a repeated status silently and records real moves in full |
|  | 05 sends items back and resolves the remake either way |
|  | 06 does not take payment while an item is being remade |
|  | 07 removes an item |
|  | 08 always creates items as OPEN |

#### `backend/test/guests.int-spec.ts` (12)

| Group | Case |
| --- | --- |
| I-GST guests | 01 turns away a wrong token and another table's token |
|  | 02 seats the first guest and lets the rest of the party join |
|  | 03 tells every caller who they are |
|  | 04 lets a guest order for their own table only, unassigned, with at least one item |
|  | 05 lets a guest add to their party's orders; other orders do not exist for them |
|  | 06 follows the party to its new table |
|  | 07 ignores forged cookies |
|  | 07b forgets the guest once the table is cleared |
|  | 08 seats a new party, with a new cookie, when someone scans after the table was cleared |
|  | 09 lets a former guest order anonymously, which seats a new party |
|  | 10 lets nobody add to their party's order once it is paid |
|  | 11 answers 400 for a valid token of a table that no longer exists, and seats nobody |

#### `backend/test/order-events.int-spec.ts` (3)

| Group | Case |
| --- | --- |
| I-EVT order events | 01 stores every change as a valid event with gap-free ids |
|  | 02 writes nothing for a request that fails |
|  | 03 records which product types an order holds, for routing to kitchen and bar |

#### `backend/test/live.int-spec.ts` (15)

| Group | Case |
| --- | --- |
| I-LIV snapshot | 01 shows every seated party at the current cursor |
|  | 02 keeps paid orders until the table is cleared |
|  | 03 shows a guest their own party, without who served them |
|  | 04 shows kitchen and bar the open orders for their station, with only their items |
| I-LIV stream | 05 needs a valid starting point |
|  | 06 replays the backlog, then says it is ready |
|  | 07 delivers a change as it commits |
|  | 08 resumes from Last-Event-ID rather than since, unless it is empty |
|  | 09 asks a client from the future to resync, and closes |
|  | 10 asks a client to resync when the changes it missed are gone |
|  | 11 shows a guest only their party, without who served them, and ends when the table is cleared |
|  | 12 shows the bar its drinks only |
|  | 13 shows the kitchen its items of an order, and nothing about tables |
|  | 14 lets the frontend read the stream across origins |
| I-LIV event retention | 15 prunes events older than 24 hours as a prefix of the log |

#### `backend/test/http.int-spec.ts` (5)

| Group | Case |
| --- | --- |
| I-HTTP cross-cutting behaviour | 01 refuses state-changing requests from foreign origins |
|  | 02 answers CORS preflights for the frontend only |
|  | 03 documents every route in the OpenAPI document |
|  | 04 answers 404 for an unknown route |
|  | 05 answers 400 for malformed JSON |

#### `backend/test/auth.int-spec.ts` (6)

| Group | Case |
| --- | --- |
| I-AUTH login routes | 01 reports the session of a signed-in caller, and null otherwise |
|  | 02 changes the password: the old one stops working, the new one works |
|  | 03 refuses a password change with the wrong current password |
|  | 04 refuses a signed-in request from a foreign origin |
|  | 04b signs in from the frontend origin with a session cookie |
|  | 05 exposes only the documented auth routes |

#### `backend/test/database.int-spec.ts` (3)

| Group | Case |
| --- | --- |
| I-DB database constraints | 01 allows one seated party per table |
|  | 02 keeps an order at its session's table |
|  | 03 keeps a single event counter |

#### `backend/test/seed.int-spec.ts` (4)

| Group | Case |
| --- | --- |
| I-SEED sample data | 01 loads on the migrated schema, with an empty event log |
|  | 02 covers every enum value, as the README promises |
|  | 03 reads back through the API in the contract shapes |
|  | 04 leaves the id sequences ready for new rows |

#### `backend/test/concurrency.int-spec.ts` (7)

| Group | Case |
| --- | --- |
| I-CON concurrent requests | 01 seats one party when a free table is scanned and seated at once |
|  | 02 never adds an item to an order that is being paid |
|  | 03 never places an order in a party that is leaving |
|  | 04 applies a repeated status move exactly once |
|  | 05 hands out event ids without gaps under concurrent writers |
|  | 06 keeps one admin when two demote each other at once |
|  | 07 leaves no orphaned items when an order is deleted while items are added |

