ALTER TABLE "Ingredient" ADD COLUMN "unit" VARCHAR(10) NOT NULL DEFAULT 'g', ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_stock_nonnegative" CHECK (stock >= 0), ADD CONSTRAINT "Ingredient_unit_valid" CHECK (unit IN ('g', 'ml', 'Stück'));
ALTER TABLE "Order_Item" ADD COLUMN "preparation_started" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "remake_count" INTEGER NOT NULL DEFAULT 0;
-- Legacy preparations must never be refunded as if still untouched.
UPDATE "Order_Item" SET "preparation_started" = true WHERE status <> 'OPEN';
CREATE TABLE "Stock_Booking" (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER REFERENCES "Order_Item"(order_item_id) ON DELETE SET NULL,
  ingredient_id INTEGER NOT NULL REFERENCES "Ingredient"(ingredient_id),
  attempt INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL CHECK (amount > 0),
  refunded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (order_item_id, attempt, ingredient_id)
);
