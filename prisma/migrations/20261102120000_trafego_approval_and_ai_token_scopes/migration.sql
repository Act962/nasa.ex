-- Spec 0130: recomendação da equipe que o cliente aprova pelo painel.
ALTER TABLE "trafego_order_event"
  ADD COLUMN "requires_approval" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "approved_at" TIMESTAMP(3),
  ADD COLUMN "approved_by_user_id" TEXT,
  ADD COLUMN "superseded_at" TIMESTAMP(3);

ALTER TABLE "trafego_order_event"
  ADD CONSTRAINT "trafego_order_event_approved_by_user_id_fkey"
  FOREIGN KEY ("approved_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "trafego_order_event_order_id_requires_approval_approved_at_idx"
  ON "trafego_order_event"("order_id", "requires_approval", "approved_at");

-- Spec 0131: escopos da chave de IA externa (planner e, só para admin do sistema, trafego).
ALTER TABLE "external_ai_access_tokens" ADD COLUMN "scopes" TEXT[] DEFAULT ARRAY['planner']::TEXT[];

-- Spec 0132: avaliação do Claude no pedido antes de publicar.
ALTER TABLE "trafego_order"
  ADD COLUMN "review_requested_at" TIMESTAMP(3),
  ADD COLUMN "review_fingerprint" TEXT,
  ADD COLUMN "review_fixes" JSONB,
  ADD COLUMN "review_notes" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "trafego_order_status_review_requested_at_idx"
  ON "trafego_order"("status", "review_requested_at");
