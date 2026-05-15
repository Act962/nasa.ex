-- ============================================================
-- MIGRATION MANUAL — FormResponses.completedAt (Fase 2 final)
-- ============================================================
-- Adiciona campo `completed_at` em form_responses pra detectar formularios
-- abandonados via cron (detect-form-abandoned).
--
-- - completedAt NULL  → resposta iniciada via save-partial mas nunca finalizada
-- - completedAt SET   → resposta finalizada via submit-response
--
-- O createdAt EXISTENTE serve como "startedAt" — não precisamos coluna nova.
--
-- Aplique com:
--   docker exec -i -e PGPASSWORD=docker nasa-db psql -U docker -d nasa_db \
--     -f - < prisma/migrations/MANUAL_form_completed_at.sql
--
-- Idempotente.
-- ============================================================

BEGIN;

ALTER TABLE "form_responses"
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);

-- Backfill: respostas existentes contam como completadas (estavam acessíveis
-- via submit antes desta migração). Sem isso, o cron acharia que TUDO foi
-- abandonado.
UPDATE "form_responses"
SET "completed_at" = "created_at"
WHERE "completed_at" IS NULL;

CREATE INDEX IF NOT EXISTS "form_responses_completed_at_idx"
  ON "form_responses" ("completed_at");

COMMIT;
