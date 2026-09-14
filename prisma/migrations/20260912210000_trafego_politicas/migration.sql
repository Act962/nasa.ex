-- trafeGO (spec 0009, Fase B-3): checagem contra as políticas de publicidade
-- de Meta, Google e WhatsApp. Só adições.

CREATE TYPE "TrafegoComplianceLevel" AS ENUM ('OK', 'WARNING', 'BLOCKED');

ALTER TABLE "trafego_pending_purchase"
  ADD COLUMN "compliance_level" "TrafegoComplianceLevel",
  ADD COLUMN "compliance_issues" JSONB,
  ADD COLUMN "compliance_acknowledged_at" TIMESTAMP(3),
  ADD COLUMN "compliance_override_by_user_id" TEXT;

ALTER TABLE "trafego_pending_purchase"
  ADD CONSTRAINT "trafego_pending_purchase_compliance_override_by_user_id_fkey"
  FOREIGN KEY ("compliance_override_by_user_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "trafego_order"
  ADD COLUMN "compliance_level" "TrafegoComplianceLevel",
  ADD COLUMN "compliance_issues" JSONB;

ALTER TABLE "trafego_copy"
  ADD COLUMN "compliance_level" "TrafegoComplianceLevel",
  ADD COLUMN "compliance_issues" JSONB,
  ADD COLUMN "compliance_checked_at" TIMESTAMP(3);
