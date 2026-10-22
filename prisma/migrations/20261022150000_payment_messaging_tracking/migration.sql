-- AlterTable
ALTER TABLE "payment_governance_config" ADD COLUMN "messaging_tracking_id" TEXT;

-- CreateIndex
CREATE INDEX "payment_governance_config_messaging_tracking_id_idx" ON "payment_governance_config"("messaging_tracking_id");

-- AddForeignKey
ALTER TABLE "payment_governance_config" ADD CONSTRAINT "payment_governance_config_messaging_tracking_id_fkey" FOREIGN KEY ("messaging_tracking_id") REFERENCES "tracking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
