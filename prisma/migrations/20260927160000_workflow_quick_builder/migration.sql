-- Construtor rápido de Gatilhos Automáticos (spec 0039).
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'SCHEDULE_TRIGGER';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'NOTIFY_TEAM';

ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "lead_id" TEXT;
CREATE INDEX IF NOT EXISTS "workflows_lead_id_idx" ON "workflows"("lead_id");
DO $$ BEGIN
  ALTER TABLE "workflows" ADD CONSTRAINT "workflows_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "workflow_schedule_claims" (
  "id" TEXT NOT NULL,
  "workflow_id" TEXT NOT NULL,
  "slot_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_schedule_claims_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_schedule_claims_workflow_id_slot_key_key"
  ON "workflow_schedule_claims"("workflow_id", "slot_key");
DO $$ BEGIN
  ALTER TABLE "workflow_schedule_claims" ADD CONSTRAINT "workflow_schedule_claims_workflow_id_fkey"
    FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
