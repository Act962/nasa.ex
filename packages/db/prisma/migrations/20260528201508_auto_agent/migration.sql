-- NASA Auto Agent: motor de agente IA autonomo orientado a objetivos.
-- Migration aditiva: enum + 2 tabelas. Idempotente.

-- Enum: status do ciclo de vida de uma sessao (lead, agente)
DO $$ BEGIN
  CREATE TYPE "LeadAgentSessionStatus" AS ENUM (
    'ACTIVE',
    'WAITING',
    'PAUSED',
    'COMPLETED',
    'TRANSFERRED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tabela de agentes. Cada org pode ter varios; trackingId null = org-wide.
CREATE TABLE IF NOT EXISTS "agents" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "tracking_id"         TEXT,
  "name"                TEXT NOT NULL,
  "description"         TEXT,
  "raw_prompt"          TEXT NOT NULL,
  "system_instructions" TEXT NOT NULL DEFAULT '',
  "spec"                JSONB NOT NULL,
  "mode"                TEXT NOT NULL DEFAULT 'AUTO',
  "is_active"           BOOLEAN NOT NULL DEFAULT false,
  "follow_up_schedule"  INTEGER[] NOT NULL DEFAULT ARRAY[1,3,5,7]::INTEGER[],
  "max_attempts"        INTEGER NOT NULL DEFAULT 4,
  "max_stars_per_lead"  INTEGER NOT NULL DEFAULT 50,
  "cooldown_minutes"    INTEGER NOT NULL DEFAULT 30,
  "stop_words"          TEXT[] NOT NULL DEFAULT ARRAY['não quero','remover','sair','spam','parar','stop']::TEXT[],
  "created_by_id"       TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agents_organization_id_is_active_idx"
  ON "agents"("organization_id", "is_active");
CREATE INDEX IF NOT EXISTS "agents_tracking_id_idx"
  ON "agents"("tracking_id");

-- FKs do Agent
DO $$ BEGIN
  ALTER TABLE "agents"
    ADD CONSTRAINT "agents_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "agents"
    ADD CONSTRAINT "agents_tracking_id_fkey"
    FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "agents"
    ADD CONSTRAINT "agents_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Tabela de sessoes (agent, lead). 1 sessao ativa por par.
CREATE TABLE IF NOT EXISTS "lead_agent_sessions" (
  "id"               TEXT NOT NULL,
  "agent_id"         TEXT NOT NULL,
  "lead_id"          TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "status"           "LeadAgentSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "current_goal_id"  TEXT,
  "attempt_count"    INTEGER NOT NULL DEFAULT 0,
  "next_action_at"   TIMESTAMP(3),
  "last_action_at"   TIMESTAMP(3),
  "stars_spent"      INTEGER NOT NULL DEFAULT 0,
  "exit_reason"      TEXT,
  "context_vars"     JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  "closed_at"        TIMESTAMP(3),
  CONSTRAINT "lead_agent_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lead_agent_sessions_agent_id_lead_id_key"
  ON "lead_agent_sessions"("agent_id", "lead_id");
CREATE INDEX IF NOT EXISTS "lead_agent_sessions_organization_id_status_idx"
  ON "lead_agent_sessions"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "lead_agent_sessions_next_action_at_status_idx"
  ON "lead_agent_sessions"("next_action_at", "status");

-- FKs da LeadAgentSession
DO $$ BEGIN
  ALTER TABLE "lead_agent_sessions"
    ADD CONSTRAINT "lead_agent_sessions_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "agents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "lead_agent_sessions"
    ADD CONSTRAINT "lead_agent_sessions_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "lead_agent_sessions"
    ADD CONSTRAINT "lead_agent_sessions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
