-- CreateTable
CREATE TABLE "Order_Event" (
    "order_event_id" BIGINT NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "table_session_id" INTEGER NOT NULL,
    "order_id" INTEGER,
    "order_item_id" INTEGER,
    "product_type" "ProductType",
    "product_types" "ProductType"[],
    "payload" JSONB NOT NULL,

    CONSTRAINT "Order_Event_pkey" PRIMARY KEY ("order_event_id")
);

-- CreateTable
CREATE TABLE "Order_Event_Counter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "value" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Order_Event_Counter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_Event_table_session_id_order_event_id_idx" ON "Order_Event"("table_session_id", "order_event_id");

-- CreateIndex
CREATE INDEX "Order_Event_occurred_at_idx" ON "Order_Event"("occurred_at");

-- The counter is a single row: event ids come from bumping it, and its row lock
-- is what serialises id allocation into commit order.
ALTER TABLE "Order_Event_Counter" ADD CONSTRAINT "Order_Event_Counter_single_row" CHECK ("id" = 1);
INSERT INTO "Order_Event_Counter" ("id", "value") VALUES (1, 0);
