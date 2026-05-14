-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION MANUAL — Sistema de Reivindicação e Denúncia de Eventos      ║
-- ║                                                                          ║
-- ║ Como aplicar:                                                            ║
-- ║   docker exec -i nasa-db psql -U docker -d nasa_db < MANUAL_event_claims_reports.sql ║
-- ║                                                                          ║
-- ║ Após aplicar, rodar:                                                     ║
-- ║   npx prisma generate                                                    ║
-- ║                                                                          ║
-- ║ TUDO ADITIVO — nenhum DROP. Seguro pra rodar em prod.                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

BEGIN;

-- ═══ Organization: verificação de marca ═══
-- (tabela física é "organization" — Prisma model mapeia via @@map)
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3);
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "verified_by" TEXT;

-- ═══ Action: disputa + score ═══
ALTER TABLE "actions" ADD COLUMN IF NOT EXISTS "is_disputed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "actions" ADD COLUMN IF NOT EXISTS "dispute_reason" TEXT;
ALTER TABLE "actions" ADD COLUMN IF NOT EXISTS "report_score" INTEGER NOT NULL DEFAULT 0;

-- ═══ Enums novos ═══
DO $$ BEGIN
  CREATE TYPE "EventClaimStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'ADMIN_RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventReportReason" AS ENUM ('BRAND_MISUSE', 'FAKE', 'OFFENSIVE', 'DUPLICATE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ═══ Tabela: event_claims ═══
CREATE TABLE IF NOT EXISTS "event_claims" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "action_id" TEXT NOT NULL,
  "claimant_user_id" TEXT,
  "claimant_org_id" TEXT,
  "claimant_email" TEXT NOT NULL,
  "claimant_name" TEXT NOT NULL,
  "response_token" TEXT NOT NULL,
  "tracking_token" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" JSONB,
  "status" "EventClaimStatus" NOT NULL DEFAULT 'PENDING',
  "creator_response" TEXT,
  "admin_note" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "resolved_at" TIMESTAMP(3),
  "resolved_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_claims_response_token_key" UNIQUE ("response_token"),
  CONSTRAINT "event_claims_tracking_token_key" UNIQUE ("tracking_token"),
  CONSTRAINT "event_claims_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "event_claims_action_id_status_idx" ON "event_claims"("action_id", "status");
CREATE INDEX IF NOT EXISTS "event_claims_expires_at_status_idx" ON "event_claims"("expires_at", "status");
CREATE INDEX IF NOT EXISTS "event_claims_claimant_email_idx" ON "event_claims"("claimant_email");

-- ═══ Tabela: event_reports ═══
CREATE TABLE IF NOT EXISTS "event_reports" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "action_id" TEXT NOT NULL,
  "reporter_user_id" TEXT,
  "reporter_email" TEXT,
  "reporter_ip" TEXT,
  "reason" "EventReportReason" NOT NULL,
  "detail" TEXT,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "status" "EventReportStatus" NOT NULL DEFAULT 'PENDING',
  "admin_note" TEXT,
  "resolved_by_user_id" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_reports_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "event_reports_action_id_status_idx" ON "event_reports"("action_id", "status");
CREATE INDEX IF NOT EXISTS "event_reports_status_created_at_idx" ON "event_reports"("status", "created_at");
CREATE INDEX IF NOT EXISTS "event_reports_reporter_ip_idx" ON "event_reports"("reporter_ip");

COMMIT;

-- ═══ Verificar resultado ═══
-- SELECT 'event_claims' AS table, COUNT(*) FROM "event_claims";
-- SELECT 'event_reports' AS table, COUNT(*) FROM "event_reports";
-- SELECT 'organization is_verified count', COUNT(*) FROM "organization" WHERE "is_verified" = true;
