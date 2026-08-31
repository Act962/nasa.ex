-- Spec 0005 — Política configurável de edição de respostas de formulário.
--
-- Duas colunas de autoria em `form_responses` e uma de política em
-- `form_settings`. Puramente aditiva: nenhuma linha existente muda de
-- comportamento, porque o default da política é o comportamento histórico.

-- CreateEnum
CREATE TYPE "FormResponseEditPolicy" AS ENUM ('TRACKING_PARTICIPANTS', 'AUTHOR_ONLY');

-- CreateEnum
CREATE TYPE "FormResponseAuthorKind" AS ENUM ('USER', 'LEAD', 'SYSTEM', 'UNKNOWN');

-- AlterTable
ALTER TABLE "form_settings" ADD COLUMN     "response_edit_policy" "FormResponseEditPolicy" NOT NULL DEFAULT 'TRACKING_PARTICIPANTS';

-- AlterTable
ALTER TABLE "form_responses" ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "author_kind" "FormResponseAuthorKind" NOT NULL DEFAULT 'UNKNOWN';

-- CreateIndex
CREATE INDEX "form_responses_created_by_id_idx" ON "form_responses"("created_by_id");

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill classificatório (spec 0005, RF-6)
--
-- Única fonte de autoria recuperável é `lead_journey_events.actor_id` cruzado
-- por `metadata->>'formResponseId'`. `lead_history` não serve: zero linhas
-- FORM_SUBMITTED têm `user_id` ou `metadata->>'createdBy'`.
--
-- Idempotente: só toca linhas ainda em 'UNKNOWN'.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) USER — existe evento de jornada com ator identificado. Usa o evento mais
--    ANTIGO como criação; eventos posteriores são edições.
WITH first_actor AS (
  SELECT DISTINCT ON (event.metadata->>'formResponseId')
         event.metadata->>'formResponseId' AS response_id,
         event.actor_id
  FROM "lead_journey_events" event
  WHERE event.kind = 'form_submit'
    AND event.actor_id IS NOT NULL
    AND event.metadata->>'formResponseId' IS NOT NULL
  ORDER BY event.metadata->>'formResponseId', event.occurred_at ASC
)
UPDATE "form_responses" response
SET "created_by_id" = first_actor.actor_id,
    "author_kind"   = 'USER'
FROM first_actor
WHERE response.id = first_actor.response_id
  AND response."author_kind" = 'UNKNOWN'
  -- Não atribui autoria a usuário que não existe mais.
  AND EXISTS (SELECT 1 FROM "user" u WHERE u.id = first_actor.actor_id);

-- 2) LEAD — tem evento de jornada, mas nenhum com ator: submit público, em que
--    quem preencheu foi o próprio lead. Classificar errado aqui é inofensivo:
--    preserva o comportamento atual em vez de travar (spec 0005, CB-16).
UPDATE "form_responses" response
SET "author_kind" = 'LEAD'
WHERE response."author_kind" = 'UNKNOWN'
  AND EXISTS (
    SELECT 1 FROM "lead_journey_events" event
    WHERE event.kind = 'form_submit'
      AND event.metadata->>'formResponseId' = response.id
  );

-- 3) O restante permanece 'UNKNOWN' — legado anterior à instrumentação.
--    Conjunto congelado: toda resposta criada a partir daqui nasce USER ou LEAD.
