-- CreateEnum
CREATE TYPE "PaymentBankTxSource" AS ENUM ('OFX_UPLOAD', 'EMAIL_INBOX', 'AGGREGATOR');

-- CreateEnum
CREATE TYPE "PaymentBankTxDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "PaymentBankTxStatus" AS ENUM ('PENDING', 'MATCHED', 'IGNORED');

-- CreateEnum
CREATE TYPE "PaymentStatementImportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "PaymentAttachmentKind" ADD VALUE 'EXTRATO';

-- AlterTable
ALTER TABLE "payment_bank_accounts" ADD COLUMN     "ofx_account_id" TEXT,
ADD COLUMN     "ofx_bank_id" TEXT,
ADD COLUMN     "statement_balance_at" TIMESTAMP(3),
ADD COLUMN     "statement_balance_cents" INTEGER;

-- CreateTable
CREATE TABLE "payment_statement_imports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "attachment_id" TEXT,
    "source" "PaymentBankTxSource" NOT NULL DEFAULT 'OFX_UPLOAD',
    "file_name" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "ofx_bank_id" TEXT,
    "ofx_account_id" TEXT,
    "currency" TEXT,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "ledger_balance_cents" INTEGER,
    "ledger_balance_at" TIMESTAMP(3),
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_count" INTEGER NOT NULL DEFAULT 0,
    "status" "PaymentStatementImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "error_message" TEXT,
    "warnings" JSONB,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_statement_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_bank_transactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "import_id" TEXT,
    "source" "PaymentBankTxSource" NOT NULL DEFAULT 'OFX_UPLOAD',
    "external_id" TEXT NOT NULL,
    "direction" "PaymentBankTxDirection" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "posted_date" TIMESTAMP(3) NOT NULL,
    "memo" TEXT NOT NULL,
    "memo_kind" TEXT,
    "counterparty_name" TEXT,
    "counterparty_document" TEXT,
    "counterparty_document_masked" BOOLEAN NOT NULL DEFAULT false,
    "raw_payload" JSONB,
    "status" "PaymentBankTxStatus" NOT NULL DEFAULT 'PENDING',
    "matched_entry_id" TEXT,
    "matched_at" TIMESTAMP(3),
    "matched_by_id" TEXT,
    "match_method" TEXT,
    "ignored_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_statement_imports_organization_id_account_id_file_h_idx" ON "payment_statement_imports"("organization_id", "account_id", "file_hash");

-- CreateIndex
CREATE INDEX "payment_statement_imports_organization_id_created_at_idx" ON "payment_statement_imports"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_bank_transactions_organization_id_status_idx" ON "payment_bank_transactions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payment_bank_transactions_organization_id_account_id_posted_idx" ON "payment_bank_transactions"("organization_id", "account_id", "posted_date");

-- CreateIndex
CREATE INDEX "payment_bank_transactions_matched_entry_id_idx" ON "payment_bank_transactions"("matched_entry_id");

-- CreateIndex
CREATE INDEX "payment_bank_transactions_import_id_idx" ON "payment_bank_transactions"("import_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_bank_transactions_organization_id_account_id_extern_key" ON "payment_bank_transactions"("organization_id", "account_id", "external_id");

-- AddForeignKey
ALTER TABLE "payment_statement_imports" ADD CONSTRAINT "payment_statement_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_statement_imports" ADD CONSTRAINT "payment_statement_imports_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "payment_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_statement_imports" ADD CONSTRAINT "payment_statement_imports_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "payment_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_bank_transactions" ADD CONSTRAINT "payment_bank_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_bank_transactions" ADD CONSTRAINT "payment_bank_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "payment_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_bank_transactions" ADD CONSTRAINT "payment_bank_transactions_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "payment_statement_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_bank_transactions" ADD CONSTRAINT "payment_bank_transactions_matched_entry_id_fkey" FOREIGN KEY ("matched_entry_id") REFERENCES "payment_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

