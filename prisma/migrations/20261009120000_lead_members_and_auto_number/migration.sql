-- Spec 0076 (vinculados do lead) e spec 0075 RF-13 (contador próprio do número automático).
-- Aditiva, exceto a chave única de form_closing_line, trocada no fim.

ALTER TABLE "forms" ADD COLUMN "auto_number_counter" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "organization"
  ADD COLUMN "lead_member_label_singular" TEXT,
  ADD COLUMN "lead_member_label_plural" TEXT;

ALTER TABLE "leads" ADD COLUMN "origin_lead_id" TEXT;

CREATE TYPE "LeadMemberBillingMode" AS ENUM ('TITULAR', 'PROPRIO');

CREATE TABLE "lead_member" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "parent_member_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "document" TEXT,
    "birth_date" DATE,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "billing_mode" "LeadMemberBillingMode" NOT NULL DEFAULT 'TITULAR',
    "cost_center_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "promoted_lead_id" TEXT,
    "promoted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_member_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_member_promoted_lead_id_key" ON "lead_member"("promoted_lead_id");
CREATE INDEX "lead_member_lead_id_idx" ON "lead_member"("lead_id");
CREATE INDEX "lead_member_organization_id_idx" ON "lead_member"("organization_id");
CREATE INDEX "lead_member_parent_member_id_idx" ON "lead_member"("parent_member_id");

ALTER TABLE "lead_member"
  ADD CONSTRAINT "lead_member_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "lead_member_parent_member_id_fkey" FOREIGN KEY ("parent_member_id") REFERENCES "lead_member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "lead_member_promoted_lead_id_fkey" FOREIGN KEY ("promoted_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "lead_member_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "payment_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "form_responses" ADD COLUMN "lead_member_id" TEXT;
ALTER TABLE "form_responses"
  ADD CONSTRAINT "form_responses_lead_member_id_fkey" FOREIGN KEY ("lead_member_id") REFERENCES "lead_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "form_record" ADD COLUMN "lead_member_id" TEXT;
CREATE INDEX "form_record_lead_member_id_idx" ON "form_record"("lead_member_id");

-- Linha do fechamento por vinculado. '' = o próprio lead: texto vazio em vez de
-- NULL, para a chave única continuar barrando duas linhas do mesmo cliente simples.
ALTER TABLE "form_closing_line"
  ADD COLUMN "lead_member_id" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "lead_member_name" TEXT,
  ADD COLUMN "billing_mode" "LeadMemberBillingMode" NOT NULL DEFAULT 'TITULAR',
  ADD COLUMN "cost_center_id" TEXT;

DROP INDEX "form_closing_line_closing_id_lead_id_key";
CREATE UNIQUE INDEX "form_closing_line_closing_id_lead_id_lead_member_id_key"
  ON "form_closing_line"("closing_id", "lead_id", "lead_member_id");
