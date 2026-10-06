ALTER TABLE "Order" ADD COLUMN "guest_id" UUID;
CREATE INDEX "Order_table_session_id_guest_id_idx" ON "Order" ("table_session_id", "guest_id");
ALTER TABLE "Order_Event" ADD COLUMN "guest_id" UUID;
CREATE TABLE "Order_Status_Log" (
  "id" SERIAL PRIMARY KEY,
  "event_id" BIGINT UNIQUE REFERENCES "Order_Event"("order_event_id") ON DELETE SET NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "employee_id" INTEGER NOT NULL,
  "employee_role" "EmployeeRole" NOT NULL,
  "order_id" INTEGER NOT NULL,
  "order_item_id" INTEGER,
  "previous_status" TEXT NOT NULL,
  "status" TEXT NOT NULL
);
CREATE INDEX "Order_Status_Log_order_id_occurred_at_idx" ON "Order_Status_Log" ("order_id", "occurred_at");
