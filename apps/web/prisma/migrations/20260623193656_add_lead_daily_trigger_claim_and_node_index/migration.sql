-- CreateTable
CREATE TABLE "lead_daily_trigger_claim" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "day_key" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_daily_trigger_claim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_daily_trigger_claim_workflow_id_idx" ON "lead_daily_trigger_claim"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_daily_trigger_claim_lead_id_workflow_id_key" ON "lead_daily_trigger_claim"("lead_id", "workflow_id");

-- CreateIndex
CREATE INDEX "nodes_workflow_id_type_idx" ON "nodes"("workflow_id", "type");

-- AddForeignKey
ALTER TABLE "lead_daily_trigger_claim" ADD CONSTRAINT "lead_daily_trigger_claim_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_daily_trigger_claim" ADD CONSTRAINT "lead_daily_trigger_claim_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
