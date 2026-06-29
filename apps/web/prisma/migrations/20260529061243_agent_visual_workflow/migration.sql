-- Modo Agente IA Visual (N8n-style) — Fase 1
-- Aditiva: novos NodeTypes, Workflow.agentMode/maxRunsPerHour/agentId,
-- WorkflowRun + WorkflowNodeRun (auditoria). Zero breaking changes:
-- workflows existentes têm agentMode=false default → engine antigo (topo-sort)
-- continua rodando inalterado.

-- ─── NodeType enum extension ───────────────────────
-- Lógica
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'IF_CONDITION';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'SWITCH_CASE';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'LOOP_OVER';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'MERGE';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'WAIT_FOR_EVENT';
-- IA
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'AI_DECISION';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'AI_GENERATE_TEXT';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'AI_VISION';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'READ_PDF';
-- Dados
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'SET_VARIABLE';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'CALL_WORKFLOW';
-- Apps NASA / Pagamento / Mídia
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'CHECK_PAYMENT';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'SEND_VOICE';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'SEND_MEDIA';
-- Triggers novos
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'PAYMENT_RECEIVED';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'MESSAGE_INCOMING';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'WEBHOOK_EXTERNAL';

-- ─── Workflow: agentMode + maxRunsPerHour + agentId ───
ALTER TABLE "workflows"
  ADD COLUMN IF NOT EXISTS "agent_mode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "max_runs_per_hour" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "agent_id" TEXT;

ALTER TABLE "workflows"
  ADD CONSTRAINT "workflows_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "workflows_agent_id_idx" ON "workflows"("agent_id");
CREATE INDEX IF NOT EXISTS "workflows_agent_mode_is_active_idx" ON "workflows"("agent_mode", "is_active");

-- ─── WorkflowRun: auditoria de execução ────────────
CREATE TABLE "workflow_runs" (
  "id" TEXT NOT NULL,
  "workflow_id" TEXT NOT NULL,
  "lead_id" TEXT,
  "trigger_type" TEXT NOT NULL,
  "initial_context" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "nodes_executed" INTEGER NOT NULL DEFAULT 0,
  "stars_spent" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workflow_runs_workflow_id_started_at_idx"
  ON "workflow_runs"("workflow_id", "started_at" DESC);
CREATE INDEX "workflow_runs_lead_id_idx" ON "workflow_runs"("lead_id");
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");

ALTER TABLE "workflow_runs"
  ADD CONSTRAINT "workflow_runs_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── WorkflowNodeRun: timeline por node ────────────
CREATE TABLE "workflow_node_runs" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "node_type" TEXT NOT NULL,
  "chosen_output" TEXT,
  "output" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  "error_message" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  CONSTRAINT "workflow_node_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workflow_node_runs_run_id_started_at_idx"
  ON "workflow_node_runs"("run_id", "started_at");
CREATE INDEX "workflow_node_runs_node_id_idx" ON "workflow_node_runs"("node_id");

ALTER TABLE "workflow_node_runs"
  ADD CONSTRAINT "workflow_node_runs_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
