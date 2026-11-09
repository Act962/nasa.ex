-- Spec 0135: campanha por cupom no modo pontos (sem sorteio). Aditiva: toda campanha existente fica como sorteio.
CREATE TYPE "LoyaltyCampaignMode" AS ENUM ('RAFFLE', 'POINTS');

ALTER TABLE "loyalty_campaigns" ADD COLUMN "mode" "LoyaltyCampaignMode" NOT NULL DEFAULT 'RAFFLE';
