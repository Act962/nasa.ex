-- AlterTable
ALTER TABLE "linnker_pages" ADD COLUMN     "qr_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "qr_message_template" TEXT,
ADD COLUMN     "vcard_overrides" JSONB;

-- AlterTable
ALTER TABLE "linnker_scans" ADD COLUMN     "scan_kind" TEXT,
ADD COLUMN     "utm_campaign" TEXT,
ADD COLUMN     "utm_medium" TEXT,
ADD COLUMN     "utm_source" TEXT;

-- CreateIndex
CREATE INDEX "linnker_scans_user_agent_created_at_idx" ON "linnker_scans"("user_agent", "created_at");
