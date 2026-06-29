/*
  Warnings:

  - You are about to drop the `actions_user_participants` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "actions" DROP CONSTRAINT "actions_created_by_fkey";

-- DropForeignKey
ALTER TABLE "actions_user_participants" DROP CONSTRAINT "actions_user_participants_action_id_fkey";

-- DropForeignKey
ALTER TABLE "actions_user_participants" DROP CONSTRAINT "actions_user_participants_user_id_fkey";

-- DropForeignKey
ALTER TABLE "actions_user_responsibles" DROP CONSTRAINT "actions_user_responsibles_action_id_fkey";

-- DropForeignKey
ALTER TABLE "actions_user_responsibles" DROP CONSTRAINT "actions_user_responsibles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "sub_actions_user_responsible" DROP CONSTRAINT "sub_actions_user_responsible_sub_action_id_fkey";

-- DropForeignKey
ALTER TABLE "sub_actions_user_responsible" DROP CONSTRAINT "sub_actions_user_responsible_user_id_fkey";

-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "lead_id" TEXT,
ADD COLUMN     "organization_id" TEXT,
ADD COLUMN     "tracking_id" TEXT;

-- DropTable
DROP TABLE "actions_user_participants";

-- CreateTable
CREATE TABLE "ActionsUserParticipant" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionsUserParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionsUserParticipant_user_id_idx" ON "ActionsUserParticipant"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ActionsUserParticipant_action_id_user_id_key" ON "ActionsUserParticipant"("action_id", "user_id");

-- CreateIndex
CREATE INDEX "actions_lead_id_idx" ON "actions"("lead_id");

-- CreateIndex
CREATE INDEX "actions_created_by_idx" ON "actions"("created_by");

-- CreateIndex
CREATE INDEX "actions_is_done_idx" ON "actions"("is_done");

-- CreateIndex
CREATE INDEX "actions_type_idx" ON "actions"("type");

-- CreateIndex
CREATE INDEX "actions_start_date_idx" ON "actions"("start_date");

-- CreateIndex
CREATE INDEX "actions_end_date_idx" ON "actions"("end_date");

-- CreateIndex
CREATE INDEX "actions_closed_at_idx" ON "actions"("closed_at");

-- CreateIndex
CREATE INDEX "sub_action_action_id_idx" ON "sub_action"("action_id");

-- CreateIndex
CREATE INDEX "sub_action_is_done_idx" ON "sub_action"("is_done");

-- CreateIndex
CREATE INDEX "sub_action_finish_date_idx" ON "sub_action"("finish_date");

-- AddForeignKey
ALTER TABLE "ActionsUserParticipant" ADD CONSTRAINT "ActionsUserParticipant_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionsUserParticipant" ADD CONSTRAINT "ActionsUserParticipant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions_user_responsibles" ADD CONSTRAINT "actions_user_responsibles_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions_user_responsibles" ADD CONSTRAINT "actions_user_responsibles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_actions_user_responsible" ADD CONSTRAINT "sub_actions_user_responsible_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_actions_user_responsible" ADD CONSTRAINT "sub_actions_user_responsible_sub_action_id_fkey" FOREIGN KEY ("sub_action_id") REFERENCES "sub_action"("id") ON DELETE CASCADE ON UPDATE CASCADE;
