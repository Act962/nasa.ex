-- Spec 0075: fichas com itens e fechamento por cliente. Só aditiva.
CREATE TYPE "FormClosingStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "form_closing" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "status" "FormClosingStatus" NOT NULL DEFAULT 'OPEN',
    "shared_cost_groups" JSONB NOT NULL DEFAULT '[]',
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "shared_cost_cents" INTEGER NOT NULL DEFAULT 0,
    "usage_cents" INTEGER NOT NULL DEFAULT 0,
    "closed_at" TIMESTAMP(3),
    "closed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_closing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_record" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "response_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "label" TEXT,
    "reference_date" TIMESTAMP(3) NOT NULL,
    "period_key" TEXT NOT NULL,
    "key_fields" JSONB NOT NULL DEFAULT '{}',
    "search_text" TEXT NOT NULL DEFAULT '',
    "usage_items" JSONB NOT NULL DEFAULT '[]',
    "usage_total_cents" INTEGER NOT NULL DEFAULT 0,
    "finalized_at" TIMESTAMP(3),
    "closing_id" TEXT,
    "source_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_option_list" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_option_list_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_closing_line" (
    "id" TEXT NOT NULL,
    "closing_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "lead_name" TEXT NOT NULL,
    "record_count" INTEGER NOT NULL,
    "usage_cents" INTEGER NOT NULL,
    "shared_cost_shares" JSONB NOT NULL DEFAULT '[]',
    "shared_cost_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "payment_entry_id" TEXT,

    CONSTRAINT "form_closing_line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "form_closing_organization_id_form_id_period_key_key" ON "form_closing"("organization_id", "form_id", "period_key");
CREATE UNIQUE INDEX "form_record_response_id_key" ON "form_record"("response_id");
CREATE INDEX "form_record_organization_id_form_id_period_key_idx" ON "form_record"("organization_id", "form_id", "period_key");
CREATE INDEX "form_record_lead_id_period_key_idx" ON "form_record"("lead_id", "period_key");
CREATE INDEX "form_record_closing_id_idx" ON "form_record"("closing_id");
CREATE UNIQUE INDEX "form_option_list_organization_id_name_key" ON "form_option_list"("organization_id", "name");
CREATE UNIQUE INDEX "form_closing_line_payment_entry_id_key" ON "form_closing_line"("payment_entry_id");
CREATE UNIQUE INDEX "form_closing_line_closing_id_lead_id_key" ON "form_closing_line"("closing_id", "lead_id");
CREATE INDEX "form_closing_line_lead_id_idx" ON "form_closing_line"("lead_id");

ALTER TABLE "form_closing" ADD CONSTRAINT "form_closing_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_record" ADD CONSTRAINT "form_record_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_record" ADD CONSTRAINT "form_record_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "form_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_record" ADD CONSTRAINT "form_record_closing_id_fkey" FOREIGN KEY ("closing_id") REFERENCES "form_closing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "form_closing_line" ADD CONSTRAINT "form_closing_line_closing_id_fkey" FOREIGN KEY ("closing_id") REFERENCES "form_closing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
