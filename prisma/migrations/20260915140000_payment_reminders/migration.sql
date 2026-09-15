-- spec 0017 — lembretes que enviam o boleto. Aditiva.
-- Rollback:
--   DROP TABLE "payment_reminders";
--   DROP TYPE "PaymentReminderStatus"; DROP TYPE "PaymentReminderChannel";

-- CreateEnum
CREATE TYPE "PaymentReminderChannel" AS ENUM ('WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "PaymentReminderStatus" AS ENUM ('SCHEDULED', 'SENT', 'PARTIAL', 'FAILED', 'SKIPPED', 'CANCELLED');

-- CreateTable
CREATE TABLE "payment_reminders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entry_id" TEXT,
    "attachment_id" TEXT,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "channels" "PaymentReminderChannel"[],
    "recipients" JSONB NOT NULL,
    "message" TEXT NOT NULL,
    "notify_creator" BOOLEAN NOT NULL DEFAULT true,
    "status" "PaymentReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "sent_at" TIMESTAMP(3),
    "delivery_log" JSONB,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_reminders_organization_id_remind_at_status_idx" ON "payment_reminders"("organization_id", "remind_at", "status");

-- CreateIndex
CREATE INDEX "payment_reminders_entry_id_idx" ON "payment_reminders"("entry_id");

-- AddForeignKey
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "payment_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "payment_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
