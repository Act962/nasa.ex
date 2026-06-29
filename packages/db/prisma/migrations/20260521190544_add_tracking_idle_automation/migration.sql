-- CreateEnum
CREATE TYPE "idle_automation_message_mode" AS ENUM ('NONE', 'FIXED', 'AI_REOPEN');

-- CreateTable
CREATE TABLE "tracking_idle_automation" (
    "id" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "no_first_resp_active" BOOLEAN NOT NULL DEFAULT false,
    "no_first_resp_minutes" INTEGER NOT NULL DEFAULT 60,
    "no_first_resp_enable_ai" BOOLEAN NOT NULL DEFAULT false,
    "no_first_resp_message_mode" "idle_automation_message_mode" NOT NULL DEFAULT 'NONE',
    "no_first_resp_message" TEXT,
    "no_first_resp_notify_resp" BOOLEAN NOT NULL DEFAULT false,
    "no_first_resp_resp_template" TEXT,
    "in_conv_active" BOOLEAN NOT NULL DEFAULT false,
    "in_conv_minutes" INTEGER NOT NULL DEFAULT 120,
    "in_conv_enable_ai" BOOLEAN NOT NULL DEFAULT false,
    "in_conv_message_mode" "idle_automation_message_mode" NOT NULL DEFAULT 'NONE',
    "in_conv_message" TEXT,
    "in_conv_notify_resp" BOOLEAN NOT NULL DEFAULT false,
    "in_conv_resp_template" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_idle_automation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracking_idle_automation_tracking_id_key" ON "tracking_idle_automation"("tracking_id");

-- AddForeignKey
ALTER TABLE "tracking_idle_automation" ADD CONSTRAINT "tracking_idle_automation_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
