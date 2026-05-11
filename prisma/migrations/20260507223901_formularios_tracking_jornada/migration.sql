-- CreateEnum
CREATE TYPE "LeadEventType" AS ENUM ('ACTION_CHANGE', 'STATUS_CHANGE', 'TRACKING_CHANGE', 'RESPONSIBLE_CHANGE', 'FORM_SUBMITTED', 'TAG_ADDED', 'TAG_REMOVED', 'FILE_UPLOADED', 'NOTE', 'PUBLIC_LINK_VIEWED', 'SLA_BREACHED');

-- DropForeignKey
ALTER TABLE "lead_history" DROP CONSTRAINT "lead_history_user_id_fkey";

-- AlterTable
ALTER TABLE "lead_history" ADD COLUMN     "event_type" "LeadEventType",
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "new_responsible_id" TEXT,
ADD COLUMN     "new_status_id" TEXT,
ADD COLUMN     "new_tracking_id" TEXT,
ADD COLUMN     "previous_responsible_id" TEXT,
ADD COLUMN     "previous_status_id" TEXT,
ADD COLUMN     "previous_tracking_id" TEXT,
ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "public_token" TEXT,
ADD COLUMN     "sla_deadline" TIMESTAMP(3),
ADD COLUMN     "status_entered_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "status" ADD COLUMN     "client_notify_template" TEXT,
ADD COLUMN     "notify_client_on_enter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sla_hours" INTEGER;

-- CreateTable
CREATE TABLE "tracking_card_config" (
    "id" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "show_sla_timer" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_card_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracking_card_config_tracking_id_key" ON "tracking_card_config"("tracking_id");

-- CreateIndex
CREATE INDEX "lead_history_event_type_idx" ON "lead_history"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "leads_public_token_key" ON "leads"("public_token");

-- AddForeignKey
ALTER TABLE "tracking_card_config" ADD CONSTRAINT "tracking_card_config_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_history" ADD CONSTRAINT "lead_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

