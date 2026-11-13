-- Fluxo de Atendimento (spec 0139)
CREATE TYPE "WorkflowKind" AS ENUM ('AUTOMATION', 'ATTENDANCE');

ALTER TYPE "NodeType" ADD VALUE 'ATTENDANCE_START';
ALTER TYPE "NodeType" ADD VALUE 'ASK_QUESTION';
ALTER TYPE "NodeType" ADD VALUE 'RANDOMIZER';
ALTER TYPE "NodeType" ADD VALUE 'DISTRIBUTE';
ALTER TYPE "NodeType" ADD VALUE 'AI_AGENT';
ALTER TYPE "NodeType" ADD VALUE 'FINISH_ATTENDANCE';

ALTER TABLE "workflows" ADD COLUMN "kind" "WorkflowKind" NOT NULL DEFAULT 'AUTOMATION';
CREATE INDEX "workflows_tracking_id_kind_is_active_idx" ON "workflows"("tracking_id", "kind", "is_active");

ALTER TABLE "workflow_runs" ADD COLUMN "attendance_lead_id" TEXT;
ALTER TABLE "workflow_runs" ADD COLUMN "current_node_id" TEXT;
ALTER TABLE "workflow_runs" ADD COLUMN "waiting_until" TIMESTAMP(3);
CREATE UNIQUE INDEX "workflow_runs_attendance_lead_id_key" ON "workflow_runs"("attendance_lead_id");
CREATE INDEX "workflow_runs_workflow_id_current_node_id_idx" ON "workflow_runs"("workflow_id", "current_node_id");
