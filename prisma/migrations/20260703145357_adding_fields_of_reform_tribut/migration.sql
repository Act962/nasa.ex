-- AlterTable
ALTER TABLE "fiscal_company_profile" ADD COLUMN     "default_consumidor_final" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ibs_cbs_classificacao_tributaria" TEXT,
ADD COLUMN     "ibs_cbs_situacao_tributaria" TEXT,
ADD COLUMN     "simples_nacional_mei" BOOLEAN NOT NULL DEFAULT false;
