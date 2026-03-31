/*
  Warnings:

  - A unique constraint covering the columns `[company_code]` on the table `organization` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "company_code" TEXT;

-- CreateTable
CREATE TABLE "action_shares" (
    "id" TEXT NOT NULL,
    "source_action_id" TEXT NOT NULL,
    "source_org_id" TEXT NOT NULL,
    "target_org_id" TEXT NOT NULL,
    "target_workspace_id" TEXT,
    "requested_by" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "rejected_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "copied_action_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_shares_source_org_id_idx" ON "action_shares"("source_org_id");

-- CreateIndex
CREATE INDEX "action_shares_target_org_id_idx" ON "action_shares"("target_org_id");

-- CreateIndex
CREATE INDEX "action_shares_status_idx" ON "action_shares"("status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_company_code_key" ON "organization"("company_code");

-- AddForeignKey
ALTER TABLE "action_shares" ADD CONSTRAINT "action_shares_source_action_id_fkey" FOREIGN KEY ("source_action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_shares" ADD CONSTRAINT "action_shares_source_org_id_fkey" FOREIGN KEY ("source_org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_shares" ADD CONSTRAINT "action_shares_target_org_id_fkey" FOREIGN KEY ("target_org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_shares" ADD CONSTRAINT "action_shares_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
