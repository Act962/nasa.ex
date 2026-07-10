-- CreateEnum
CREATE TYPE "NfseStandard" AS ENUM ('MUNICIPAL', 'NACIONAL');

-- CreateEnum
CREATE TYPE "FiscalGateway" AS ENUM ('NFE_IO', 'FOCUS_NFE');

-- AlterEnum
ALTER TYPE "FiscalInvoiceType" ADD VALUE 'NFSE_NACIONAL';

-- AlterTable
ALTER TABLE "fiscal_company_profile" ADD COLUMN     "auto_issue_on_entry_paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "default_city_service_code" TEXT,
ADD COLUMN     "default_codigo_cnae" TEXT,
ADD COLUMN     "default_codigo_tributario_municipio" TEXT,
ADD COLUMN     "default_cofins_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "default_consumidor_final" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "default_csll_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "default_deducoes_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "default_desconto_condicionado_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "default_desconto_incondicionado_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "default_informacoes_adicionais" TEXT,
ADD COLUMN     "default_inss_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "default_ir_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "default_outras_retencoes_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "default_pis_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "default_serie_dps" INTEGER DEFAULT 1,
ADD COLUMN     "default_tributacao_issqn" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "fiscal_gateway" "FiscalGateway" NOT NULL DEFAULT 'NFE_IO',
ADD COLUMN     "focus_webhook_id_homologacao" TEXT,
ADD COLUMN     "focus_webhook_id_nfsen_homologacao" TEXT,
ADD COLUMN     "focus_webhook_id_nfsen_producao" TEXT,
ADD COLUMN     "focus_webhook_id_producao" TEXT,
ADD COLUMN     "ibs_cbs_classificacao_tributaria" TEXT,
ADD COLUMN     "ibs_cbs_situacao_tributaria" TEXT,
ADD COLUMN     "legal_nature" TEXT,
ADD COLUMN     "nfe_io_certificate_expires_on" TIMESTAMP(3),
ADD COLUMN     "nfe_io_certificate_status" TEXT,
ADD COLUMN     "nfe_io_company_id" TEXT,
ADD COLUMN     "nfe_io_fiscal_status" TEXT,
ADD COLUMN     "nfse_standard" "NfseStandard" NOT NULL DEFAULT 'MUNICIPAL',
ADD COLUMN     "opening_date" TIMESTAMP(3),
ADD COLUMN     "simples_nacional_mei" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tax_regime" TEXT;

-- AlterTable
ALTER TABLE "fiscal_invoice" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "flow_status" TEXT,
ADD COLUMN     "gateway" "FiscalGateway" NOT NULL DEFAULT 'FOCUS_NFE',
ADD COLUMN     "payment_entry_id" TEXT;

-- CreateIndex
CREATE INDEX "fiscal_invoice_payment_entry_id_idx" ON "fiscal_invoice"("payment_entry_id");

-- CreateIndex
CREATE INDEX "fiscal_invoice_external_id_idx" ON "fiscal_invoice"("external_id");

-- AddForeignKey
ALTER TABLE "fiscal_invoice" ADD CONSTRAINT "fiscal_invoice_payment_entry_id_fkey" FOREIGN KEY ("payment_entry_id") REFERENCES "payment_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
