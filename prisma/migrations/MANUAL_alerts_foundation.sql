-- ============================================================
-- MIGRATION MANUAL — Alerts Foundation (Fase 0)
-- ============================================================
-- Aplique este SQL no banco em produção/dev e depois rode:
--   pnpm db:generate
--
-- Este script é idempotente (usa IF NOT EXISTS) e seguro pra rodar
-- múltiplas vezes. Não toca dados existentes — só estende schema.
-- ============================================================

BEGIN;

-- ─── 1. Estender admin_notification com severity/displaySurface/ack ──────────
ALTER TABLE "admin_notification"
  ADD COLUMN IF NOT EXISTS "severity"        TEXT NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS "display_surface" TEXT NOT NULL DEFAULT 'bell',
  ADD COLUMN IF NOT EXISTS "requires_ack"    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "alert_rule_id"   TEXT,
  ADD COLUMN IF NOT EXISTS "event_type"      TEXT,
  ADD COLUMN IF NOT EXISTS "event_payload"   JSONB;

-- ─── 2. Estender admin_notification_read com acknowledgedAt ──────────────────
ALTER TABLE "admin_notification_read"
  ADD COLUMN IF NOT EXISTS "acknowledged_at" TIMESTAMP(3);

-- ─── 3. Criar alert_rule ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "alert_rule" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "organization_id"  TEXT,
  "name"             TEXT NOT NULL,
  "description"      TEXT,
  "event_type"       TEXT NOT NULL,
  "params"           JSONB NOT NULL DEFAULT '{}',
  "severity"         TEXT NOT NULL DEFAULT 'info',
  "audience"         JSONB NOT NULL,
  "channels"         JSONB NOT NULL DEFAULT '["in_app"]',
  "display_surface"  TEXT NOT NULL DEFAULT 'bell',
  "is_active"        BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by"       TEXT NOT NULL,
  "cooldown_minutes" INTEGER,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL
);

-- ─── 4. Criar alert_dispatch (idempotência) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "alert_dispatch" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "alert_rule_id" TEXT NOT NULL,
  "entity_key"    TEXT NOT NULL,
  "dispatched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── 5. Índices ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "admin_notification_severity_requires_ack_idx"
  ON "admin_notification" ("severity", "requires_ack");

CREATE INDEX IF NOT EXISTS "admin_notification_alert_rule_id_idx"
  ON "admin_notification" ("alert_rule_id");

CREATE INDEX IF NOT EXISTS "alert_rule_event_type_is_active_idx"
  ON "alert_rule" ("event_type", "is_active");

CREATE INDEX IF NOT EXISTS "alert_rule_organization_id_idx"
  ON "alert_rule" ("organization_id");

CREATE INDEX IF NOT EXISTS "alert_dispatch_alert_rule_id_dispatched_at_idx"
  ON "alert_dispatch" ("alert_rule_id", "dispatched_at");

CREATE UNIQUE INDEX IF NOT EXISTS "alert_dispatch_alert_rule_id_entity_key_key"
  ON "alert_dispatch" ("alert_rule_id", "entity_key");

-- ─── 6. Foreign Keys ─────────────────────────────────────────────────────────
ALTER TABLE "admin_notification"
  DROP CONSTRAINT IF EXISTS "admin_notification_alert_rule_id_fkey",
  ADD CONSTRAINT  "admin_notification_alert_rule_id_fkey"
    FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alert_rule"
  DROP CONSTRAINT IF EXISTS "alert_rule_organization_id_fkey",
  ADD CONSTRAINT  "alert_rule_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alert_dispatch"
  DROP CONSTRAINT IF EXISTS "alert_dispatch_alert_rule_id_fkey",
  ADD CONSTRAINT  "alert_dispatch_alert_rule_id_fkey"
    FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rule"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

-- ============================================================
-- Pós-migração:
--   pnpm db:generate
--
-- (opcional) Seed da regra default pra preservar comportamento de
-- check-reminders.ts antes de adotarmos o alert engine:
--   INSERT INTO alert_rule (id, name, event_type, audience, severity,
--                           display_surface, channels, is_active, created_by,
--                           created_at, updated_at)
--   VALUES (
--     'seed_agenda_reminder',
--     'Lembrete de agenda (default)',
--     'agenda.reminder_fired',
--     '{"kind":"action_participants"}',
--     'info', 'bell', '["in_app","whatsapp"]',
--     TRUE, 'SYSTEM',
--     NOW(), NOW()
--   ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
