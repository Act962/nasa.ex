-- CreateEnum
CREATE TYPE "NfseStandard" AS ENUM ('MUNICIPAL', 'NACIONAL');

-- AlterEnum
ALTER TYPE "FiscalInvoiceType" ADD VALUE 'NFSE_NACIONAL';

-- AlterTable
ALTER TABLE "fiscal_company_profile" ADD COLUMN     "default_serie_dps" INTEGER DEFAULT 1,
ADD COLUMN     "focus_webhook_id_nfsen_homologacao" TEXT,
ADD COLUMN     "focus_webhook_id_nfsen_producao" TEXT,
ADD COLUMN     "nfse_standard" "NfseStandard" NOT NULL DEFAULT 'MUNICIPAL';
