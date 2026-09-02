-- DropForeignKey
ALTER TABLE "Order_Item" DROP CONSTRAINT "Order_Item_order_id_fkey";

-- DropForeignKey
ALTER TABLE "Product_Ingredient" DROP CONSTRAINT "Product_Ingredient_product_id_fkey";

-- AddForeignKey
ALTER TABLE "Order_Item" ADD CONSTRAINT "Order_Item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product_Ingredient" ADD CONSTRAINT "Product_Ingredient_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;
