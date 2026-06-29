-- ============================================================
-- 2026-05  NASA Route — novos formatos de produto
-- ============================================================
-- Aplicar com:
--   psql "$DATABASE_URL" -f scripts/sql/migrations/2026-05-add-product-formats.sql
-- Depois: pnpm db:generate
--
-- Mudanças:
--   1. nasa_route_course — colunas opcionais por formato:
--        eBook (file_key, file_name, file_size, mime_type, page_count)
--        Evento Online (starts_at, ends_at, stream_url, timezone, location_note)
--        Comunidade (type, invite_url, rules)
--        Assinatura (period)
--   2. nasa_route_subscription — registro de assinatura recorrente
--      (status, next_charge_at, failed_charge_count etc).
-- ============================================================

BEGIN;

-- ── 1. Novas colunas em nasa_route_course ────────────────────
ALTER TABLE "nasa_route_course"
  ADD COLUMN IF NOT EXISTS "ebook_file_key"       TEXT,
  ADD COLUMN IF NOT EXISTS "ebook_file_name"      TEXT,
  ADD COLUMN IF NOT EXISTS "ebook_file_size"      INTEGER,
  ADD COLUMN IF NOT EXISTS "ebook_mime_type"      TEXT,
  ADD COLUMN IF NOT EXISTS "ebook_page_count"     INTEGER,
  ADD COLUMN IF NOT EXISTS "event_starts_at"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "event_ends_at"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "event_stream_url"     TEXT,
  ADD COLUMN IF NOT EXISTS "event_timezone"       TEXT,
  ADD COLUMN IF NOT EXISTS "event_location_note"  TEXT,
  ADD COLUMN IF NOT EXISTS "community_type"       TEXT,
  ADD COLUMN IF NOT EXISTS "community_invite_url" TEXT,
  ADD COLUMN IF NOT EXISTS "community_rules"      TEXT,
  ADD COLUMN IF NOT EXISTS "subscription_period"  TEXT;

-- ── 2. Tabela nasa_route_subscription ────────────────────────
CREATE TABLE IF NOT EXISTS "nasa_route_subscription" (
  "id"                       TEXT          PRIMARY KEY,
  "enrollment_id"            TEXT          NOT NULL UNIQUE,
  "status"                   TEXT          NOT NULL DEFAULT 'active',
  "started_at"               TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "current_period_start"     TIMESTAMP(3)  NOT NULL,
  "current_period_end"       TIMESTAMP(3)  NOT NULL,
  "next_charge_at"           TIMESTAMP(3)  NOT NULL,
  "last_charged_at"          TIMESTAMP(3),
  "failed_charge_count"      INTEGER       NOT NULL DEFAULT 0,
  "cancelled_at"             TIMESTAMP(3),
  "cancel_reason"            TEXT,
  "created_at"               TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "nasa_route_subscription_next_charge_status_idx"
  ON "nasa_route_subscription" ("next_charge_at", "status");

-- FK pra enrollment (cascata se enrollment for deletado)
DO $$ BEGIN
  ALTER TABLE "nasa_route_subscription"
    ADD CONSTRAINT "nrs_enrollment_fk"
      FOREIGN KEY ("enrollment_id") REFERENCES "nasa_route_enrollment"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

COMMIT;

-- ============================================================
-- Notas:
--   • Coluna `format` na tabela nasa_route_course é TEXT sem CHECK
--     constraint — validação dos novos valores ("ebook", "event",
--     "community", "subscription") fica no Zod do procedure
--     `creatorUpsertCourse`.
--   • Cursos existentes não são afetados (todos os campos novos são
--     nullable). Apenas novas criações usam os formatos novos.
-- ============================================================
