-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StarTransactionType" ADD VALUE 'CYCLE_EXPIRE';
ALTER TYPE "StarTransactionType" ADD VALUE 'PLAN_UPGRADE_DELTA';

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "stars_cycle_end" TIMESTAMP(3),
ADD COLUMN     "stars_cycle_period_key" TEXT,
ADD COLUMN     "stars_protected_balance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "star_transactions" ADD COLUMN     "period_key" TEXT;

-- AlterTable
ALTER TABLE "workspace_integrations" ADD COLUMN     "last_charged_period_key" TEXT;

-- CreateTable
CREATE TABLE "org_star_cycles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "plan_id" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "cycle_start" TIMESTAMP(3) NOT NULL,
    "cycle_end" TIMESTAMP(3) NOT NULL,
    "monthly_stars" INTEGER NOT NULL DEFAULT 0,
    "rollover_applied" INTEGER NOT NULL DEFAULT 0,
    "balance_before" INTEGER NOT NULL DEFAULT 0,
    "balance_after" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_star_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_star_cycles_organization_id_cycle_start_idx" ON "org_star_cycles"("organization_id", "cycle_start");

-- CreateIndex
CREATE INDEX "org_star_cycles_status_idx" ON "org_star_cycles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "org_star_cycles_organization_id_period_key_key" ON "org_star_cycles"("organization_id", "period_key");

-- CreateIndex
CREATE INDEX "star_transactions_organization_id_period_key_idx" ON "star_transactions"("organization_id", "period_key");

-- AddForeignKey
ALTER TABLE "org_star_cycles" ADD CONSTRAINT "org_star_cycles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
