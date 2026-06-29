/*
  Warnings:

  - A unique constraint covering the columns `[public_token]` on the table `leads` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LeadEventType" AS ENUM ('ACTION_CHANGE', 'STATUS_CHANGE', 'TRACKING_CHANGE', 'RESPONSIBLE_CHANGE', 'FORM_SUBMITTED', 'TAG_ADDED', 'TAG_REMOVED', 'FILE_UPLOADED', 'NOTE', 'PUBLIC_LINK_VIEWED', 'SLA_BREACHED');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('ONLINE', 'IN_PERSON');

-- AlterEnum
ALTER TYPE "NodeType" ADD VALUE 'FIRST_CHAT_INTERACTION';

-- DropForeignKey
ALTER TABLE "lead_history" DROP CONSTRAINT "lead_history_user_id_fkey";

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "gcal_event_id" TEXT,
ADD COLUMN     "meeting_type" "MeetingType" NOT NULL DEFAULT 'ONLINE';

-- AlterTable
ALTER TABLE "form_responses" ADD COLUMN     "label" TEXT,
ADD COLUMN     "label_manually_edited" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "form_settings" ADD COLUMN     "next_button_action" JSONB NOT NULL DEFAULT '{"type":"next_block"}',
ADD COLUMN     "next_button_label" TEXT NOT NULL DEFAULT 'Próximo',
ADD COLUMN     "progress_mascots" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "step_mode" TEXT NOT NULL DEFAULT 'off';

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

-- AlterTable
ALTER TABLE "tracking" ADD COLUMN     "card_background_blur" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "card_background_image" TEXT,
ADD COLUMN     "card_background_opacity" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "card_border_color" TEXT;

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
