-- Spec: specs/stars/0021-registro-de-custo-por-evento-e-instrumentacao.md
--
-- Registro de custo por evento: passa a ser possível responder "quanto custa
-- atender esta organização", quebrado por solução, feature, usuário, fornecedor,
-- modelo, dia e mês.
--
-- ESTRITAMENTE ADITIVA (RNF-3 da spec 0021): uma tabela nova, um enum novo e
-- três colunas opcionais. Nenhum DROP, nenhum RENAME. Nenhuma linha de saldo ou
-- de extrato é reescrita — as colunas novas ficam nulas nas linhas antigas.
--
-- ROLLBACK:
--   Reverter o código faz o sistema parar de gravar; o que já foi registrado
--   continua consultável e nenhum saldo foi alterado.
--   Se for preciso desfazer de fato:
--     DROP TABLE "usage_event";
--     DROP TYPE "UsageEventKind";
--     ALTER TABLE "star_transactions" DROP COLUMN "user_id", DROP COLUMN "action";
--     ALTER TABLE "router_payment_settings" DROP COLUMN "usd_to_brl_rate";
--   Perde-se o histórico de custo acumulado. Saldo e extrato ficam intactos.

-- ── Câmbio configurável ──────────────────────────────────────────────────────
-- Sai do código porque é o número que de fato varia e o financeiro precisa
-- ajustar sem deploy.
ALTER TABLE "router_payment_settings"
  ADD COLUMN "usd_to_brl_rate" DECIMAL(10,4) NOT NULL DEFAULT 5.5;

-- ── Atribuição no extrato de Stars ───────────────────────────────────────────
ALTER TABLE "star_transactions" ADD COLUMN "user_id" TEXT;
ALTER TABLE "star_transactions" ADD COLUMN "action" TEXT;

-- ── Registro de custo por evento ─────────────────────────────────────────────
CREATE TYPE "UsageEventKind" AS ENUM (
  'LLM', 'EMBEDDING', 'IMAGE', 'VIDEO', 'TRANSCRIPTION',
  'MESSAGE', 'STORAGE', 'EMAIL', 'REALTIME', 'OTHER'
);

CREATE TABLE "usage_event" (
    "id"                  TEXT NOT NULL,
    "organization_id"     TEXT NOT NULL,
    "user_id"             TEXT,
    "kind"                "UsageEventKind" NOT NULL,
    "action"              TEXT NOT NULL,
    "app_slug"            TEXT,
    "feature"             TEXT,
    "provider"            TEXT,
    "model_id"            TEXT,
    "using_custom_key"    BOOLEAN NOT NULL DEFAULT false,
    "input_tokens"        INTEGER,
    "output_tokens"       INTEGER,
    "cached_tokens"       INTEGER,
    "total_tokens"        INTEGER,
    "quantity"            DECIMAL(16,4),
    "quantity_unit"       TEXT,
    "provider_cost_usd"   DECIMAL(14,8),
    "infra_cost_usd"      DECIMAL(14,8),
    "cost_brl"            DECIMAL(14,6),
    "usd_to_brl_rate"     DECIMAL(10,4),
    "price_source"        TEXT,
    "stars_charged"       INTEGER NOT NULL DEFAULT 0,
    "star_price_brl"      DECIMAL(10,4),
    "revenue_brl"         DECIMAL(14,6),
    "star_transaction_id" TEXT,
    "session_id"          TEXT,
    "tracking_id"         TEXT,
    "lead_id"             TEXT,
    "request_id"          TEXT,
    "status"              TEXT NOT NULL DEFAULT 'ok',
    "latency_ms"          INTEGER,
    "metadata"            JSONB,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usage_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "usage_event_organization_id_created_at_idx"
  ON "usage_event"("organization_id", "created_at");
CREATE INDEX "usage_event_organization_id_action_created_at_idx"
  ON "usage_event"("organization_id", "action", "created_at");
CREATE INDEX "usage_event_provider_model_id_created_at_idx"
  ON "usage_event"("provider", "model_id", "created_at");
CREATE INDEX "usage_event_kind_created_at_idx"
  ON "usage_event"("kind", "created_at");
CREATE INDEX "usage_event_star_transaction_id_idx"
  ON "usage_event"("star_transaction_id");

-- `star_transaction_id` é ligação solta, SEM foreign key de propósito: também
-- registramos o evento gratuito e o que falhou por saldo, casos em que não
-- existe transação nenhuma.
ALTER TABLE "usage_event"
  ADD CONSTRAINT "usage_event_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
