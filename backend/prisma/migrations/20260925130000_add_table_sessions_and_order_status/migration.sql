-- Orders move from belonging to a table to belonging to a table session: one
-- party's time at the table, from first QR scan until service clears it.

CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "Table_Session" (
    "table_session_id" SERIAL NOT NULL,
    "table_id" INTEGER NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "Table_Session_pkey" PRIMARY KEY ("table_session_id")
);

CREATE INDEX "Table_Session_table_id_idx" ON "Table_Session"("table_id");

-- Target of the composite foreign key from "Order".
CREATE UNIQUE INDEX "Table_Session_table_session_id_table_id_key" ON "Table_Session"("table_session_id", "table_id");

-- At most one open session per table. Prisma cannot express a partial index,
-- so it lives only here; the schema documents it on the model.
CREATE UNIQUE INDEX "Table_Session_one_open_per_table" ON "Table_Session"("table_id") WHERE "closed_at" IS NULL;

ALTER TABLE "Table_Session" ADD CONSTRAINT "Table_Session_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "Table"("table_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
    ADD COLUMN "closed_at" TIMESTAMP(3),
    ADD COLUMN "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
    ADD COLUMN "table_session_id" INTEGER;

-- Backfill: existing orders predate sessions, so every table that has orders
-- gets one open session holding all of them. Nothing is known about which
-- orders were paid, so they all stay OPEN.
INSERT INTO "Table_Session" ("table_id")
SELECT DISTINCT "table_id" FROM "Order";

UPDATE "Order" o
SET "table_session_id" = s."table_session_id"
FROM "Table_Session" s
WHERE s."table_id" = o."table_id";

ALTER TABLE "Order" ALTER COLUMN "table_session_id" SET NOT NULL;

CREATE INDEX "Order_table_session_id_idx" ON "Order"("table_session_id");

-- Composite key: an order's table_id must match its session's table_id, and
-- moving a session cascades the new table onto its orders.
ALTER TABLE "Order" ADD CONSTRAINT "Order_table_session_id_table_id_fkey" FOREIGN KEY ("table_session_id", "table_id") REFERENCES "Table_Session"("table_session_id", "table_id") ON DELETE RESTRICT ON UPDATE CASCADE;
