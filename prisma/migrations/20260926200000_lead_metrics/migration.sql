-- Métricas do lead (spec 0035, "Auditar Lead").
DO $$ BEGIN
  CREATE TYPE "LeadInterestLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LeadMetricsSource" AS ENUM ('COMPUTED', 'AI');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "lead_metrics" (
  "id" TEXT NOT NULL,
  "lead_id" TEXT NOT NULL,
  "purchase_potential" INTEGER NOT NULL DEFAULT 0,
  "interest_level" "LeadInterestLevel" NOT NULL DEFAULT 'LOW',
  "purchases_count" INTEGER NOT NULL DEFAULT 0,
  "interactions_per_month" INTEGER NOT NULL DEFAULT 0,
  "avg_attendance_seconds" INTEGER,
  "interaction_loss_rate" INTEGER NOT NULL DEFAULT 0,
  "avg_response_seconds" INTEGER,
  "quality_score" INTEGER,
  "resolution_rate" INTEGER,
  "source" "LeadMetricsSource" NOT NULL DEFAULT 'COMPUTED',
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "ai_rationale" TEXT,
  "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ai_audited_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lead_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lead_metrics_lead_id_key" ON "lead_metrics"("lead_id");
CREATE INDEX IF NOT EXISTS "lead_metrics_purchase_potential_idx" ON "lead_metrics"("purchase_potential");
CREATE INDEX IF NOT EXISTS "lead_metrics_interest_level_idx" ON "lead_metrics"("interest_level");
CREATE INDEX IF NOT EXISTS "lead_metrics_interaction_loss_rate_idx" ON "lead_metrics"("interaction_loss_rate");

DO $$ BEGIN
  ALTER TABLE "lead_metrics" ADD CONSTRAINT "lead_metrics_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
