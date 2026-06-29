-- AlterTable
ALTER TABLE "payment_entries" ADD COLUMN     "tracking_id" TEXT;

-- CreateIndex
CREATE INDEX "payment_entries_tracking_id_idx" ON "payment_entries"("tracking_id");

-- AddForeignKey
ALTER TABLE "payment_entries" ADD CONSTRAINT "payment_entries_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
