-- Sample data for local development and manual testing.
--
-- This file contains DATA ONLY. The schema is owned by the Prisma migrations in
-- backend/prisma/migrations, so apply those first:
--
--   cd backend && pnpm exec prisma migrate deploy
--
-- Then run `pnpm db:seed` from the repository root. Prisma executes seed.mjs,
-- which sends this file directly to PostgreSQL over DATABASE_URL.
--
-- Re-running resets all sample data and authentication accounts. Ids stay stable.

BEGIN;

TRUNCATE TABLE
  "Order_Item",
  "Order",
  "Table_Session",
  "Product_Ingredient",
  "Product",
  "Ingredient",
  "Table",
  "Employee",
  "session",
  "account",
  "verification",
  "user"
  RESTART IDENTITY CASCADE;

--
-- Employees. Covers every EmployeeRole variant: ADMIN, SERVICE, KITCHEN, BAR.
--
INSERT INTO "Employee" (employee_id, firstname, lastname, role) VALUES
  (1, 'Alessandro', 'Greco',    'ADMIN'),
  (2, 'Giulia',     'Ferrari',  'SERVICE'),
  (3, 'Sofia',      'Marino',   'SERVICE'),
  (4, 'Marco',      'Ricci',    'KITCHEN'),
  (5, 'Luca',       'Barbieri', 'KITCHEN'),
  (6, 'Elena',      'Conti',    'BAR');

--
-- Dining room. Table numbers are unique; 7 and 8 are the terrace.
--
INSERT INTO "Table" (table_id, table_number, seats) VALUES
  (1, 1, 2),
  (2, 2, 2),
  (3, 3, 4),
  (4, 4, 4),
  (5, 5, 6),
  (6, 6, 4),
  (7, 7, 8),
  (8, 8, 6);

--
-- Ingredients used by the recipes below.
--
INSERT INTO "Ingredient" (ingredient_id, name) VALUES
  (1,  'Farina 00'),
  (2,  'Pomodoro San Marzano'),
  (3,  'Mozzarella di bufala'),
  (4,  'Basilico'),
  (5,  'Olio extravergine di oliva'),
  (6,  'Parmigiano Reggiano'),
  (7,  'Pecorino Romano'),
  (8,  'Guanciale'),
  (9,  'Uovo'),
  (10, 'Pepe nero'),
  (11, 'Spaghetti'),
  (12, 'Tagliatelle'),
  (13, 'Aglio'),
  (14, 'Peperoncino'),
  (15, 'Prezzemolo'),
  (16, 'Vongole'),
  (17, 'Vino bianco secco'),
  (18, 'Riso Carnaroli'),
  (19, 'Zafferano'),
  (20, 'Burro'),
  (21, 'Brodo di pollo'),
  (22, 'Salame piccante'),
  (23, 'Melanzane'),
  (24, 'Ricotta'),
  (25, 'Vitello'),
  (26, 'Prosciutto crudo'),
  (27, 'Salvia'),
  (28, 'Melone'),
  (29, 'Bresaola'),
  (30, 'Rucola'),
  (31, 'Limone'),
  (32, 'Mascarpone'),
  (33, 'Savoiardi'),
  (34, 'Caffe espresso'),
  (35, 'Cacao amaro'),
  (36, 'Panna fresca'),
  (37, 'Zucchero'),
  (38, 'Manzo macinato'),
  (39, 'Carota'),
  (40, 'Sedano'),
  (41, 'Cipolla'),
  (42, 'Pane casereccio'),
  (43, 'Sale marino');

--
-- Menu. Covers every ProductType variant: APPETIZER, FOOD, DRINK.
-- Prices are in euro; description is capped at 100 characters by the column.
--
INSERT INTO "Product" (product_id, name, description, price, type) VALUES
  -- Antipasti
  (1,  'Bruschetta al Pomodoro',    'Grilled bread with San Marzano tomatoes, garlic and basil',        6.50,  'APPETIZER'),
  (2,  'Caprese di Bufala',         'Buffalo mozzarella, tomatoes and basil with olive oil',            10.50, 'APPETIZER'),
  (3,  'Prosciutto e Melone',       'Cured ham with sweet melon',                                       9.50,  'APPETIZER'),
  (4,  'Carpaccio di Bresaola',     'Air-dried beef with rocket, parmesan and lemon',                   11.00, 'APPETIZER'),
  -- Primi
  (5,  'Spaghetti alla Carbonara',  'Spaghetti with guanciale, egg, pecorino and black pepper',         13.50, 'FOOD'),
  (6,  'Spaghetti alle Vongole',    'Spaghetti with clams, garlic, chilli and parsley',                 16.50, 'FOOD'),
  (7,  'Tagliatelle al Ragu',       'Fresh tagliatelle with slow-cooked beef ragu',                     14.00, 'FOOD'),
  (8,  'Risotto allo Zafferano',    'Carnaroli rice with saffron, butter and parmesan',                 15.00, 'FOOD'),
  -- Pizze
  (9,  'Pizza Margherita',          'Tomato, buffalo mozzarella and basil',                             10.50, 'FOOD'),
  (10, 'Pizza Diavola',             'Tomato, mozzarella and spicy salame',                              12.50, 'FOOD'),
  -- Secondi
  (11, 'Melanzane alla Parmigiana', 'Baked aubergine with tomato, parmesan and ricotta',                12.50, 'FOOD'),
  (12, 'Saltimbocca alla Romana',   'Veal with prosciutto and sage in a butter sauce',                  18.50, 'FOOD'),
  -- Dolci
  (13, 'Tiramisu',                  'Mascarpone, savoiardi and espresso dusted with cocoa',             7.50,  'FOOD'),
  (14, 'Panna Cotta',               'Set cream with a lemon and sugar glaze',                           6.50,  'FOOD'),
  -- Bevande
  (15, 'Acqua Minerale 0,75L',      'Still or sparkling mineral water',                                 3.00,  'DRINK'),
  (16, 'Chianti Classico',          'Glass of Tuscan red wine',                                         6.50,  'DRINK'),
  (17, 'Aperol Spritz',             'Aperol, prosecco and soda over ice',                               8.00,  'DRINK'),
  (18, 'Birra Moretti 0,33L',       'Italian lager',                                                    4.50,  'DRINK'),
  (19, 'Espresso',                  NULL,                                                               2.20,  'DRINK'),
  (20, 'Limonata',                  'Fresh lemonade',                                                   3.50,  'DRINK');

--
-- Recipes. Product_Ingredient is keyed by (product_id, ingredient_id), so each
-- ingredient appears at most once per product. Drinks other than espresso and
-- limonata carry no recipe.
--
INSERT INTO "Product_Ingredient" (product_id, ingredient_id, amount) VALUES
  -- Bruschetta al Pomodoro
  (1, 42, 2), (1, 2, 80), (1, 13, 1), (1, 4, 2), (1, 5, 10),
  -- Caprese di Bufala
  (2, 3, 125), (2, 2, 100), (2, 4, 3), (2, 5, 10),
  -- Prosciutto e Melone
  (3, 26, 80), (3, 28, 200),
  -- Carpaccio di Bresaola
  (4, 29, 70), (4, 30, 20), (4, 6, 15), (4, 31, 1), (4, 5, 10),
  -- Spaghetti alla Carbonara
  (5, 11, 120), (5, 8, 60), (5, 9, 2), (5, 7, 40), (5, 10, 2),
  -- Spaghetti alle Vongole
  (6, 11, 120), (6, 16, 250), (6, 13, 2), (6, 14, 1), (6, 15, 5), (6, 17, 50),
  -- Tagliatelle al Ragu
  (7, 12, 120), (7, 38, 150), (7, 2, 120), (7, 39, 40), (7, 40, 30), (7, 41, 40), (7, 6, 20),
  -- Risotto allo Zafferano
  (8, 18, 100), (8, 19, 1), (8, 20, 30), (8, 6, 30), (8, 21, 400), (8, 41, 30), (8, 43, 3),
  -- Pizza Margherita
  (9, 1, 250), (9, 2, 100), (9, 3, 100), (9, 4, 3), (9, 5, 10), (9, 43, 5),
  -- Pizza Diavola
  (10, 1, 250), (10, 2, 100), (10, 3, 100), (10, 22, 60), (10, 14, 1), (10, 43, 5),
  -- Melanzane alla Parmigiana
  (11, 23, 300), (11, 2, 200), (11, 6, 50), (11, 24, 80), (11, 4, 2), (11, 43, 4),
  -- Saltimbocca alla Romana
  (12, 25, 180), (12, 26, 40), (12, 27, 3), (12, 20, 25), (12, 17, 40),
  -- Tiramisu
  (13, 32, 250), (13, 33, 120), (13, 34, 60), (13, 35, 5), (13, 9, 2), (13, 37, 60),
  -- Panna Cotta
  (14, 36, 200), (14, 37, 40), (14, 31, 1),
  -- Espresso
  (19, 34, 7),
  -- Limonata
  (20, 31, 2), (20, 37, 20);

--
-- Table sessions: one party's time at a table. Tables 1, 3 and 5 each seated an
-- earlier party that has paid and left, so those sessions are closed; tables 3
-- and 5 have since seated a new party. Table 1 is free again.
--
INSERT INTO "Table_Session" (table_session_id, table_id, opened_at, closed_at) VALUES
  (1,  1, now() - interval '3 hours',          now() - interval '2 hours'),
  (2,  3, now() - interval '3 hours',          now() - interval '1 hour 45 minutes'),
  (3,  5, now() - interval '2 hours 30 minutes', now() - interval '1 hour 30 minutes'),
  (4,  2, now() - interval '50 minutes',       NULL),
  (5,  7, now() - interval '45 minutes',       NULL),
  (6,  4, now() - interval '40 minutes',       NULL),
  (7,  6, now() - interval '35 minutes',       NULL),
  (8,  8, now() - interval '15 minutes',       NULL),
  (9,  3, now() - interval '10 minutes',       NULL),
  (10, 5, now() - interval '5 minutes',        NULL);

--
-- Orders. Orders 1-3 are paid, so they are CLOSED and belong to the closed
-- sessions above; every item on them is SERVED, as closing requires. Order 6
-- has no employee assigned, exercising the nullable FK.
--
INSERT INTO "Order" (order_id, table_session_id, table_id, employee_id, status, closed_at) VALUES
  (1,  1,  1, 2,    'CLOSED', now() - interval '2 hours 5 minutes'),
  (2,  2,  3, 2,    'CLOSED', now() - interval '1 hour 50 minutes'),
  (3,  3,  5, 3,    'CLOSED', now() - interval '1 hour 35 minutes'),
  (4,  4,  2, 3,    'OPEN',   NULL),
  (5,  5,  7, 2,    'OPEN',   NULL),
  (6,  6,  4, NULL, 'OPEN',   NULL),
  (7,  7,  6, 3,    'OPEN',   NULL),
  (8,  8,  8, 2,    'OPEN',   NULL),
  (9,  9,  3, 3,    'OPEN',   NULL),
  (10, 10, 5, 2,    'OPEN',   NULL);

--
-- Order items. Covers every OrderItemStatus variant: SERVED, READY,
-- IN_PROGRESS, OPEN and REMAKE. Ordering two of the same product is expressed
-- by repeating the product, because Order_Item has no quantity column and each
-- row carries its own status.
--
-- Orders 1-3 are finished, 4-7 are mid-service, 8-10 have just been taken.
--
INSERT INTO "Order_Item" (order_item_id, order_id, product_id, status) VALUES
  -- Order 1: paid and cleared
  (1,  1, 9,  'SERVED'),
  (2,  1, 16, 'SERVED'),
  (3,  1, 13, 'SERVED'),
  -- Order 2: paid and cleared
  (4,  2, 5,  'SERVED'),
  (5,  2, 1,  'SERVED'),
  (6,  2, 15, 'SERVED'),
  (7,  2, 19, 'SERVED'),
  -- Order 3: paid and cleared
  (8,  3, 7,  'SERVED'),
  (9,  3, 11, 'SERVED'),
  (10, 3, 16, 'SERVED'),
  (11, 3, 16, 'SERVED'),
  -- Order 4: drinks served, mains plated and waiting to go out
  (12, 4, 17, 'SERVED'),
  (13, 4, 6,  'READY'),
  (14, 4, 8,  'READY'),
  -- Order 5: large table, kitchen still working
  (15, 5, 2,  'SERVED'),
  (16, 5, 4,  'SERVED'),
  (17, 5, 10, 'IN_PROGRESS'),
  (18, 5, 10, 'IN_PROGRESS'),
  (19, 5, 12, 'IN_PROGRESS'),
  (20, 5, 18, 'SERVED'),
  -- Order 6: sent back, being made again
  (21, 6, 5,  'REMAKE'),
  (22, 6, 15, 'SERVED'),
  -- Order 7: antipasti out, primo on the pass
  (23, 7, 3,  'SERVED'),
  (24, 7, 8,  'READY'),
  (25, 7, 16, 'SERVED'),
  -- Order 8: just taken, nothing started
  (26, 8, 9,  'OPEN'),
  (27, 8, 10, 'OPEN'),
  (28, 8, 18, 'OPEN'),
  (29, 8, 18, 'OPEN'),
  -- Order 9: just taken
  (30, 9, 6,  'OPEN'),
  (31, 9, 20, 'OPEN'),
  -- Order 10: starter in the oven
  (32, 10, 1,  'IN_PROGRESS'),
  (33, 10, 14, 'OPEN'),
  (34, 10, 19, 'OPEN');

--
-- Explicit ids were used above, so the identity sequences have to be moved past
-- them or the next API insert would collide.
--
SELECT setval('"Employee_employee_id_seq"',     (SELECT MAX(employee_id)   FROM "Employee"));
SELECT setval('"Table_table_id_seq"',           (SELECT MAX(table_id)      FROM "Table"));
SELECT setval('"Ingredient_ingredient_id_seq"', (SELECT MAX(ingredient_id) FROM "Ingredient"));
SELECT setval('"Product_product_id_seq"',       (SELECT MAX(product_id)    FROM "Product"));
SELECT setval('"Table_Session_table_session_id_seq"', (SELECT MAX(table_session_id) FROM "Table_Session"));
SELECT setval('"Order_order_id_seq"',           (SELECT MAX(order_id)      FROM "Order"));
SELECT setval('"Order_Item_order_item_id_seq"', (SELECT MAX(order_item_id) FROM "Order_Item"));

COMMIT;
