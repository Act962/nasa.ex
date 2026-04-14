-- AlterTable
ALTER TABLE "admin_notification" ADD COLUMN     "action_url" TEXT,
ADD COLUMN     "app_key" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "organization_id" TEXT,
ADD COLUMN     "sent_whatsapp" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "admin_notification_organization_id_idx" ON "admin_notification"("organization_id");
