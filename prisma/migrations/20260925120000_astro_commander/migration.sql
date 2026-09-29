-- Spec: specs/astro/0028-astro-commander.md
--
-- ASTRO COMMANDER: comandos persistentes que o ASTRO executa sozinho (uma vez,
-- por agenda ou por evento), com trilha de execução, memórias da organização e
-- feedback das respostas.
--
-- ESTRITAMENTE ADITIVA: quatro tabelas novas, onze enums novos e quatro colunas
-- opcionais/com default em tabelas existentes. Nenhum DROP, nenhum RENAME.
-- Nenhuma linha existente é reescrita.
--
-- ROLLBACK:
--   Reverter o código já basta: nada passa a ser gravado e nenhum dado antigo
--   mudou. Para desfazer de fato:
--     DROP TABLE "astro_feedbacks";
--     DROP TABLE "astro_memories";
--     DROP TABLE "astro_command_runs";
--     DROP TABLE "astro_commands";
--     DROP TYPE "AstroFeedbackRating", "AstroMemoryStatus", "AstroMemorySource",
--       "AstroMemoryKind", "AstroCommandRunStatus", "AstroCommandRunTrigger",
--       "AstroCommandStatus", "AstroCommandAutonomy", "AstroCommandTrigger",
--       "AstroCommandPersona";
--     ALTER TABLE "plans" DROP COLUMN "commander_runs_included",
--       DROP COLUMN "commander_max_active_commands";
--     ALTER TABLE "organization" DROP COLUMN "astro_commander_paused_at";

-- ── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE "AstroCommandPersona" AS ENUM ('SALES', 'FINANCE', 'ADMIN', 'ACCOUNTING', 'CUSTOM');
CREATE TYPE "AstroCommandTrigger" AS ENUM ('ONCE', 'SCHEDULE', 'EVENT');
CREATE TYPE "AstroCommandAutonomy" AS ENUM ('DRAFT', 'APPROVE_ABOVE', 'AUTO');
CREATE TYPE "AstroCommandStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "AstroCommandRunTrigger" AS ENUM ('SCHEDULE', 'EVENT', 'MANUAL', 'TEST');
CREATE TYPE "AstroCommandRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'WAITING_APPROVAL', 'SKIPPED_LIMIT', 'SKIPPED');
CREATE TYPE "AstroMemoryKind" AS ENUM ('FACT', 'RULE', 'PREFERENCE');
CREATE TYPE "AstroMemorySource" AS ENUM ('MANUAL', 'FEEDBACK', 'EXECUTION');
CREATE TYPE "AstroMemoryStatus" AS ENUM ('SUGGESTED', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "AstroFeedbackRating" AS ENUM ('POSITIVE', 'NEGATIVE');

-- ── Cota do Commander no plano ───────────────────────────────────────────────
-- Default 0 de propósito: plano que ninguém configurou não libera o Commander.
ALTER TABLE "plans" ADD COLUMN "commander_runs_included" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN "commander_max_active_commands" INTEGER NOT NULL DEFAULT 0;

-- ── "Pausar tudo" por organização ────────────────────────────────────────────
ALTER TABLE "organization" ADD COLUMN "astro_commander_paused_at" TIMESTAMP(3);

-- ── Comandos ─────────────────────────────────────────────────────────────────
CREATE TABLE "astro_commands" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "instruction" TEXT NOT NULL,
  "persona" "AstroCommandPersona" NOT NULL DEFAULT 'CUSTOM',
  "icon_url" TEXT,
  "trigger_type" "AstroCommandTrigger" NOT NULL DEFAULT 'ONCE',
  "cron" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  "run_at" TIMESTAMP(3),
  "event_key" TEXT,
  "model_id" TEXT,
  "system_prompt" TEXT,
  "greeting_message" TEXT,
  "vocabulary" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "blocked_words" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "knowledge_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "tool_scope" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "tool_approvals" JSONB NOT NULL DEFAULT '{}',
  "connected_apps" JSONB NOT NULL DEFAULT '{}',
  "voice_config" JSONB NOT NULL DEFAULT '{}',
  "execution_config" JSONB NOT NULL DEFAULT '{}',
  "autonomy" "AstroCommandAutonomy" NOT NULL DEFAULT 'DRAFT',
  "approval_threshold" DECIMAL(12,2),
  "max_runs_per_day" INTEGER NOT NULL DEFAULT 24,
  "max_stars_per_run" INTEGER NOT NULL DEFAULT 200,
  "status" "AstroCommandStatus" NOT NULL DEFAULT 'DRAFT',
  "last_run_at" TIMESTAMP(3),
  "next_run_at" TIMESTAMP(3),
  "paused_reason" TEXT,
  "is_template" BOOLEAN NOT NULL DEFAULT false,
  "template_source_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "astro_commands_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "astro_commands_org_status_updated_idx" ON "astro_commands" ("organization_id", "status", "updated_at" DESC);
-- Varredura do tick a cada minuto: comandos ativos com disparo vencido.
CREATE INDEX "astro_commands_status_next_run_idx" ON "astro_commands" ("status", "next_run_at");
-- Listeners: quem nesta organização reage a `lead.created`.
CREATE INDEX "astro_commands_org_event_status_idx" ON "astro_commands" ("organization_id", "event_key", "status");

ALTER TABLE "astro_commands"
  ADD CONSTRAINT "astro_commands_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "astro_commands"
  ADD CONSTRAINT "astro_commands_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Execuções ────────────────────────────────────────────────────────────────
CREATE TABLE "astro_command_runs" (
  "id" TEXT NOT NULL,
  "command_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "trigger" "AstroCommandRunTrigger" NOT NULL,
  "status" "AstroCommandRunStatus" NOT NULL DEFAULT 'RUNNING',
  "scheduled_for" TIMESTAMP(3),
  "trigger_key" TEXT,
  "steps" JSONB NOT NULL DEFAULT '[]',
  "summary" TEXT,
  "tokens_in" INTEGER NOT NULL DEFAULT 0,
  "tokens_out" INTEGER NOT NULL DEFAULT 0,
  "stars_charged" INTEGER NOT NULL DEFAULT 0,
  "pending_action_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "error" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),

  CONSTRAINT "astro_command_runs_pkey" PRIMARY KEY ("id")
);

-- Idempotência do tick (CB-3) e do evento (CA-5). NULL não colide com NULL em
-- Postgres, então run manual (sem os dois campos) nunca é barrado.
CREATE UNIQUE INDEX "astro_command_runs_command_scheduled_key" ON "astro_command_runs" ("command_id", "scheduled_for");
CREATE UNIQUE INDEX "astro_command_runs_command_trigger_key" ON "astro_command_runs" ("command_id", "trigger_key");
CREATE INDEX "astro_command_runs_org_started_idx" ON "astro_command_runs" ("organization_id", "started_at" DESC);
CREATE INDEX "astro_command_runs_command_started_idx" ON "astro_command_runs" ("command_id", "started_at" DESC);

ALTER TABLE "astro_command_runs"
  ADD CONSTRAINT "astro_command_runs_command_id_fkey"
  FOREIGN KEY ("command_id") REFERENCES "astro_commands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "astro_command_runs"
  ADD CONSTRAINT "astro_command_runs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Memórias da organização ──────────────────────────────────────────────────
CREATE TABLE "astro_memories" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "kind" "AstroMemoryKind" NOT NULL DEFAULT 'FACT',
  "content" TEXT NOT NULL,
  "rule_key" TEXT,
  "numeric_value" DECIMAL(12,2),
  "scope" TEXT NOT NULL DEFAULT 'org',
  "source" "AstroMemorySource" NOT NULL DEFAULT 'MANUAL',
  "status" "AstroMemoryStatus" NOT NULL DEFAULT 'SUGGESTED',
  "source_ref" TEXT,
  "created_by_id" TEXT,
  "approved_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "astro_memories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "astro_memories_org_status_updated_idx" ON "astro_memories" ("organization_id", "status", "updated_at" DESC);
CREATE INDEX "astro_memories_org_rule_status_idx" ON "astro_memories" ("organization_id", "rule_key", "status");

ALTER TABLE "astro_memories"
  ADD CONSTRAINT "astro_memories_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "astro_memories"
  ADD CONSTRAINT "astro_memories_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "astro_memories"
  ADD CONSTRAINT "astro_memories_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Feedback das respostas ───────────────────────────────────────────────────
CREATE TABLE "astro_feedbacks" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "session_id" TEXT,
  "run_id" TEXT,
  "message_id" TEXT,
  "rating" "AstroFeedbackRating" NOT NULL,
  "correction" TEXT,
  "answer_excerpt" TEXT,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "astro_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "astro_feedbacks_org_created_idx" ON "astro_feedbacks" ("organization_id", "created_at" DESC);
CREATE INDEX "astro_feedbacks_org_processed_idx" ON "astro_feedbacks" ("organization_id", "processed_at");

ALTER TABLE "astro_feedbacks"
  ADD CONSTRAINT "astro_feedbacks_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "astro_feedbacks"
  ADD CONSTRAINT "astro_feedbacks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
