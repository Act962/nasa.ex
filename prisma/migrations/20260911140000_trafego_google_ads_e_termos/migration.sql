-- trafeGO: Google Ads no catálogo + aceite de termos no checkout
--
-- Só adições: novos valores de enum e colunas nullable. Nada existente muda.

-- AlterEnum: nova plataforma
ALTER TYPE "TrafegoPlatform" ADD VALUE 'GOOGLE_ADS';

-- AlterEnum: objetivo exclusivo da rede de pesquisa
ALTER TYPE "TrafegoObjective" ADD VALUE 'SEARCH';

-- AlterTable: prova de consentimento na compra
ALTER TABLE "trafego_pending_purchase" ADD COLUMN "accepted_terms_at" TIMESTAMP(3);
ALTER TABLE "trafego_pending_purchase" ADD COLUMN "accepted_terms_version" TEXT;

ALTER TABLE "trafego_order" ADD COLUMN "accepted_terms_at" TIMESTAMP(3);
ALTER TABLE "trafego_order" ADD COLUMN "accepted_terms_version" TEXT;
