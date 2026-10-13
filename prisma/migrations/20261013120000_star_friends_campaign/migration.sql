-- STAR FRIENDS: campanha de sorteio por cupom (spec 0102). Só aditiva.
ALTER TYPE "LoyaltyLedgerSource" ADD VALUE IF NOT EXISTS 'CAMPAIGN_RECEIPT';

CREATE TYPE "LoyaltyReceiptStatus" AS ENUM ('ACCEPTED', 'DUPLICATE', 'REJECTED', 'VOIDED');
CREATE TYPE "LoyaltyLuckyNumberStatus" AS ENUM ('VALID', 'VOIDED');

CREATE TABLE "loyalty_campaigns" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tracking_id" TEXT,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "amount_per_number_cents" INTEGER NOT NULL DEFAULT 10000,
  "issuer_documents" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "rules_summary" TEXT NOT NULL,
  "rules_url" TEXT,
  "rules_version" TEXT NOT NULL,
  "max_receipts_per_day" INTEGER NOT NULL DEFAULT 5,
  "last_sweep_at" TIMESTAMP(3),
  "drawn_at" TIMESTAMP(3),
  "draw_seed" TEXT,
  "winner_number_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "loyalty_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "loyalty_campaigns_organization_id_is_active_idx" ON "loyalty_campaigns"("organization_id", "is_active");

CREATE TABLE "loyalty_campaign_entries" (
  "id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "registered_phone" TEXT NOT NULL,
  "accepted_rules_version" TEXT NOT NULL,
  "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "carry_over_cents" INTEGER NOT NULL DEFAULT 0,
  "total_spent_cents" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "loyalty_campaign_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "loyalty_campaign_entries_campaign_id_member_id_key" ON "loyalty_campaign_entries"("campaign_id", "member_id");

CREATE TABLE "loyalty_receipts" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "lead_id" TEXT,
  "message_id" TEXT NOT NULL,
  "file_key" TEXT,
  "mimetype" TEXT,
  "file_size" INTEGER,
  "file_sha256" TEXT,
  "access_key" TEXT,
  "fingerprint" TEXT,
  "issuer_document" TEXT,
  "receipt_number" TEXT,
  "issued_at" TIMESTAMP(3),
  "total_cents" INTEGER,
  "status" "LoyaltyReceiptStatus" NOT NULL,
  "is_flagged" BOOLEAN NOT NULL DEFAULT false,
  "flag_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "reject_reason" TEXT,
  "duplicate_of_id" TEXT,
  "numbers_awarded" INTEGER NOT NULL DEFAULT 0,
  "raw_extraction" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "loyalty_receipts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "loyalty_receipts_message_id_key" ON "loyalty_receipts"("message_id");
CREATE UNIQUE INDEX "loyalty_receipts_campaign_id_file_sha256_key" ON "loyalty_receipts"("campaign_id", "file_sha256");
CREATE UNIQUE INDEX "loyalty_receipts_campaign_id_access_key_key" ON "loyalty_receipts"("campaign_id", "access_key");
CREATE UNIQUE INDEX "loyalty_receipts_campaign_id_fingerprint_key" ON "loyalty_receipts"("campaign_id", "fingerprint");
CREATE INDEX "loyalty_receipts_campaign_id_status_created_at_idx" ON "loyalty_receipts"("campaign_id", "status", "created_at");
CREATE INDEX "loyalty_receipts_member_id_created_at_idx" ON "loyalty_receipts"("member_id", "created_at");

CREATE TABLE "loyalty_lucky_numbers" (
  "id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "receipt_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" "LoyaltyLuckyNumberStatus" NOT NULL DEFAULT 'VALID',
  "void_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_lucky_numbers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "loyalty_lucky_numbers_campaign_id_code_key" ON "loyalty_lucky_numbers"("campaign_id", "code");
CREATE INDEX "loyalty_lucky_numbers_campaign_id_status_idx" ON "loyalty_lucky_numbers"("campaign_id", "status");
CREATE INDEX "loyalty_lucky_numbers_member_id_idx" ON "loyalty_lucky_numbers"("member_id");

ALTER TABLE "loyalty_campaigns" ADD CONSTRAINT "loyalty_campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_campaign_entries" ADD CONSTRAINT "loyalty_campaign_entries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "loyalty_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_campaign_entries" ADD CONSTRAINT "loyalty_campaign_entries_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "loyalty_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_receipts" ADD CONSTRAINT "loyalty_receipts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "loyalty_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_receipts" ADD CONSTRAINT "loyalty_receipts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "loyalty_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_lucky_numbers" ADD CONSTRAINT "loyalty_lucky_numbers_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "loyalty_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_lucky_numbers" ADD CONSTRAINT "loyalty_lucky_numbers_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "loyalty_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_lucky_numbers" ADD CONSTRAINT "loyalty_lucky_numbers_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "loyalty_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
