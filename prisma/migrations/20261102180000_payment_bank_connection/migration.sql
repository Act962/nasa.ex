-- CreateEnum
CREATE TYPE "PaymentBankProvider" AS ENUM ('INTER');

-- AlterEnum
ALTER TYPE "PaymentBankTxSource" ADD VALUE 'BANK_API';

-- AlterTable
ALTER TABLE "payment_entries" ADD COLUMN     "pix_amount_cents" INTEGER,
ADD COLUMN     "pix_connection_id" TEXT,
ADD COLUMN     "pix_copy_paste" TEXT,
ADD COLUMN     "pix_due_date" TIMESTAMP(3),
ADD COLUMN     "pix_provider" "PaymentBankProvider",
ADD COLUMN     "pix_txid" TEXT;

-- CreateTable
CREATE TABLE "payment_bank_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider" "PaymentBankProvider" NOT NULL,
    "environment" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_enc" TEXT NOT NULL,
    "certificate_enc" TEXT,
    "private_key_enc" TEXT,
    "certificate_valid_to" TIMESTAMP(3),
    "scopes" TEXT NOT NULL,
    "pix_key" TEXT NOT NULL,
    "account_number" TEXT,
    "access_token_enc" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "webhook_token" TEXT NOT NULL,
    "webhook_registered_at" TIMESTAMP(3),
    "is_default_for_charges" BOOLEAN NOT NULL DEFAULT false,
    "last_error_message" TEXT,
    "last_error_at" TIMESTAMP(3),
    "certificate_alert_days" INTEGER,
    "connected_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_bank_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_bank_connections_account_id_key" ON "payment_bank_connections"("account_id");

-- CreateIndex
CREATE INDEX "payment_bank_connections_organization_id_is_default_for_cha_idx" ON "payment_bank_connections"("organization_id", "is_default_for_charges");

-- CreateIndex
CREATE UNIQUE INDEX "payment_entries_pix_txid_key" ON "payment_entries"("pix_txid");

-- CreateIndex
CREATE INDEX "payment_entries_pix_connection_id_idx" ON "payment_entries"("pix_connection_id");

-- AddForeignKey
ALTER TABLE "payment_bank_connections" ADD CONSTRAINT "payment_bank_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_bank_connections" ADD CONSTRAINT "payment_bank_connections_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "payment_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_entries" ADD CONSTRAINT "payment_entries_pix_connection_id_fkey" FOREIGN KEY ("pix_connection_id") REFERENCES "payment_bank_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

