-- CreateEnum
CREATE TYPE "PaymentBankChargeMethod" AS ENUM ('PIX', 'BOLETO_PIX');

-- CreateEnum
CREATE TYPE "PaymentBoletoStatus" AS ENUM ('PROCESSING', 'ACTIVE', 'FAILED');

-- AlterTable
ALTER TABLE "payment_bank_connections" ADD COLUMN     "boleto_discount_bps" INTEGER,
ADD COLUMN     "boleto_discount_days" INTEGER,
ADD COLUMN     "boleto_fine_bps" INTEGER,
ADD COLUMN     "boleto_interest_monthly_bps" INTEGER,
ADD COLUMN     "boleto_webhook_registered_at" TIMESTAMP(3),
ADD COLUMN     "charge_method" "PaymentBankChargeMethod" NOT NULL DEFAULT 'PIX',
ADD COLUMN     "permissions_checked_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payment_contacts" ADD COLUMN     "address_city" TEXT,
ADD COLUMN     "address_complement" TEXT,
ADD COLUMN     "address_neighborhood" TEXT,
ADD COLUMN     "address_number" TEXT,
ADD COLUMN     "address_state" TEXT,
ADD COLUMN     "address_street" TEXT,
ADD COLUMN     "address_zip_code" TEXT;

-- AlterTable
ALTER TABLE "payment_entries" ADD COLUMN     "boleto_amount_cents" INTEGER,
ADD COLUMN     "boleto_barcode" TEXT,
ADD COLUMN     "boleto_digitable_line" TEXT,
ADD COLUMN     "boleto_due_date" TIMESTAMP(3),
ADD COLUMN     "boleto_issued_at" TIMESTAMP(3),
ADD COLUMN     "boleto_request_id" TEXT,
ADD COLUMN     "boleto_status" "PaymentBoletoStatus";

-- CreateIndex
CREATE UNIQUE INDEX "payment_entries_boleto_request_id_key" ON "payment_entries"("boleto_request_id");

