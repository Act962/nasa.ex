-- AlterTable
ALTER TABLE "payment_entries" ADD COLUMN     "lead_id" TEXT;

-- CreateIndex
CREATE INDEX "payment_entries_lead_id_idx" ON "payment_entries"("lead_id");

-- AddForeignKey
ALTER TABLE "payment_entries" ADD CONSTRAINT "payment_entries_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
