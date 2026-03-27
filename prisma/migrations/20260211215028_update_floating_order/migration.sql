-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "order" DROP DEFAULT,
ALTER COLUMN "order" SET DATA TYPE DECIMAL(20,10);

-- CreateIndex
CREATE INDEX "leads_status_id_order_idx" ON "leads"("status_id", "order");

-- CreateIndex
CREATE INDEX "leads_status_id_created_at_idx" ON "leads"("status_id", "created_at");
