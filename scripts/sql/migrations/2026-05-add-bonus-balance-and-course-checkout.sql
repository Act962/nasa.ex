-- ============================================================
-- 2026-05  STARS bonus split + Public course checkout
-- ============================================================
-- Aplicar com:
--   psql "$DATABASE_URL" -f scripts/sql/migrations/2026-05-add-bonus-balance-and-course-checkout.sql
-- Depois: pnpm db:generate
--
-- Mudanças:
--   1. Organization.stars_bonus_balance (Int, default 0) — saldo de bônus
--      separado, NÃO usado pra comprar curso no NASA Router.
--   2. Enum StarTransactionType.WELCOME_BONUS — tipo da transação de bônus.
--   3. Tabela router_payment_settings (singleton) — cotação R$/STAR.
--   4. Tabela pending_course_purchase + enum — checkout público sem conta.
-- ============================================================

BEGIN;

-- ── 1. Organization.starsBonusBalance ────────────────────────
ALTER TABLE "organization"
  ADD COLUMN IF NOT EXISTS "stars_bonus_balance" INTEGER NOT NULL DEFAULT 0;

-- ── 2. Novo enum value WELCOME_BONUS ─────────────────────────
ALTER TYPE "StarTransactionType" ADD VALUE IF NOT EXISTS 'WELCOME_BONUS';

-- ── 3. Novo enum PendingCoursePurchaseStatus ─────────────────
DO $$ BEGIN
  CREATE TYPE "PendingCoursePurchaseStatus" AS ENUM (
    'PENDING','PAID','REDEEMED','EXPIRED','REFUNDED','CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 4. RouterPaymentSettings (singleton id='singleton') ──────
CREATE TABLE IF NOT EXISTS "router_payment_settings" (
  "id"             TEXT PRIMARY KEY,
  "star_price_brl" DECIMAL(10,4) NOT NULL DEFAULT 0.15,
  "updated_at"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by_id"  TEXT
);

INSERT INTO "router_payment_settings" ("id", "star_price_brl")
  VALUES ('singleton', 0.15)
  ON CONFLICT ("id") DO NOTHING;

DO $$ BEGIN
  ALTER TABLE "router_payment_settings"
    ADD CONSTRAINT "router_payment_settings_updated_by_fk"
      FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 5. PendingCoursePurchase ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "pending_course_purchase" (
  "id"                       TEXT PRIMARY KEY,
  "email"                    TEXT NOT NULL,
  "course_id"                TEXT NOT NULL,
  "plan_id"                  TEXT,
  "price_stars"              INTEGER NOT NULL,
  "amount_brl_cents"         INTEGER NOT NULL,
  "star_price_brl_snapshot"  DECIMAL(10,4) NOT NULL,
  "stripe_session_id"        TEXT,
  "stripe_payment_intent_id" TEXT,
  "signup_token"             TEXT,
  "token_expires_at"         TIMESTAMP(3),
  "status"                   "PendingCoursePurchaseStatus" NOT NULL DEFAULT 'PENDING',
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paid_at"                  TIMESTAMP(3),
  "redeemed_at"              TIMESTAMP(3),
  "redeemed_by_user_id"      TEXT,
  "redeemed_enrollment_id"   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "pending_course_purchase_signup_token_key"
  ON "pending_course_purchase"("signup_token");
CREATE INDEX IF NOT EXISTS "pending_course_purchase_email_idx"
  ON "pending_course_purchase"("email");
CREATE INDEX IF NOT EXISTS "pending_course_purchase_status_idx"
  ON "pending_course_purchase"("status");
CREATE INDEX IF NOT EXISTS "pending_course_purchase_stripe_session_idx"
  ON "pending_course_purchase"("stripe_session_id");

DO $$ BEGIN
  ALTER TABLE "pending_course_purchase"
    ADD CONSTRAINT "pending_course_purchase_course_fk"
      FOREIGN KEY ("course_id") REFERENCES "nasa_route_course"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "pending_course_purchase"
    ADD CONSTRAINT "pending_course_purchase_plan_fk"
      FOREIGN KEY ("plan_id") REFERENCES "nasa_route_plan"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "pending_course_purchase"
    ADD CONSTRAINT "pending_course_purchase_user_fk"
      FOREIGN KEY ("redeemed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

COMMIT;

-- ============================================================
-- BACKFILL OPCIONAL — não recomendado por padrão.
-- ============================================================
-- O bônus de welcome antigo foi creditado direto em stars_balance.
-- Distinguir "quanto do saldo atual veio do bônus" exige analisar histórico
-- (rollovers, refunds) e é frágil. Impacto pequeno: usuários pré-existentes
-- podem usar até 100★ "antigos" pra cursos uma única vez.
-- Se quiser corrigir, descomente e rode SEPARADAMENTE:
--
-- BEGIN;
-- WITH bonus_orgs AS (
--   SELECT t."organization_id" AS org_id, t.amount AS bonus_amt
--   FROM "star_transactions" t
--   WHERE t.type = 'MANUAL_ADJUST'
--     AND t.description = '🎉 Bônus de boas-vindas ao NASA'
-- ), eligible AS (
--   SELECT bo.org_id, LEAST(o.stars_balance, bo.bonus_amt) AS to_move
--   FROM bonus_orgs bo
--   JOIN "organization" o ON o.id = bo.org_id
--   WHERE o.stars_balance >= bo.bonus_amt
-- )
-- UPDATE "organization" o
--    SET stars_balance       = o.stars_balance - e.to_move,
--        stars_bonus_balance = o.stars_bonus_balance + e.to_move
--   FROM eligible e
--  WHERE o.id = e.org_id;
-- COMMIT;
