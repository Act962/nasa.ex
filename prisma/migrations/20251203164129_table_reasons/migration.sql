-- CreateEnum
CREATE TYPE "ReasonType" AS ENUM ('WIN', 'LOSS');

-- CreateEnum
CREATE TYPE "LeadAction" AS ENUM ('ACTIVE', 'DELETED', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "current_action" "LeadAction" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "win_loss_reasons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ReasonType" NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "win_loss_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_history" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "action" "LeadAction" NOT NULL,
    "reason_id" TEXT,
    "notes" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "win_loss_reasons_tracking_id_idx" ON "win_loss_reasons"("tracking_id");

-- CreateIndex
CREATE INDEX "lead_history_lead_id_idx" ON "lead_history"("lead_id");

-- CreateIndex
CREATE INDEX "lead_history_action_idx" ON "lead_history"("action");

-- CreateIndex
CREATE INDEX "lead_history_created_at_idx" ON "lead_history"("created_at");

-- CreateIndex
CREATE INDEX "leads_current_action_idx" ON "leads"("current_action");

-- CreateIndex
CREATE INDEX "leads_is_active_idx" ON "leads"("is_active");

-- AddForeignKey
ALTER TABLE "win_loss_reasons" ADD CONSTRAINT "win_loss_reasons_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_history" ADD CONSTRAINT "lead_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_history" ADD CONSTRAINT "lead_history_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "win_loss_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_history" ADD CONSTRAINT "lead_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
