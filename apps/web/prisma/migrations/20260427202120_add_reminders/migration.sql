-- CreateEnum
CREATE TYPE "ReminderRecurrenceType" AS ENUM ('ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recurrence_type" "ReminderRecurrenceType" NOT NULL,
    "day_of_month" INTEGER,
    "remind_time" TEXT NOT NULL,
    "notify_phone" TEXT,
    "next_remind_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "lead_id" TEXT,
    "conversation_id" TEXT,
    "tracking_id" TEXT,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_occurrences" (
    "id" TEXT NOT NULL,
    "reminder_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminders_next_remind_at_is_active_idx" ON "reminders"("next_remind_at", "is_active");

-- CreateIndex
CREATE INDEX "reminders_conversation_id_idx" ON "reminders"("conversation_id");

-- CreateIndex
CREATE INDEX "reminders_lead_id_idx" ON "reminders"("lead_id");

-- CreateIndex
CREATE INDEX "reminders_tracking_id_idx" ON "reminders"("tracking_id");

-- CreateIndex
CREATE INDEX "reminder_occurrences_reminder_id_idx" ON "reminder_occurrences"("reminder_id");

-- CreateIndex
CREATE INDEX "reminder_occurrences_scheduled_at_sent_idx" ON "reminder_occurrences"("scheduled_at", "sent");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_occurrences" ADD CONSTRAINT "reminder_occurrences_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
