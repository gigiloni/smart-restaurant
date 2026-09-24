-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_employee_id_fkey";

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;
