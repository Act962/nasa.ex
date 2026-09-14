-- trafeGO: simulador por faixa de investimento
--
-- O preço deixou de vir de um plano fixo e passa a ser calculado pela verba:
-- a taxa cai conforme o investimento sobe, e o setup da BM é cobrado apenas de
-- quem ainda não tem conta de anúncios. Por isso `plan_id` vira opcional e
-- entram o percentual aplicado, o setup e a resposta sobre a BM.

-- AlterTable: TrafegoPendingPurchase
ALTER TABLE "trafego_pending_purchase" ALTER COLUMN "plan_id" DROP NOT NULL;
ALTER TABLE "trafego_pending_purchase" ADD COLUMN "has_business_manager" BOOLEAN;
ALTER TABLE "trafego_pending_purchase" ADD COLUMN "service_fee_percent" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "trafego_pending_purchase" ADD COLUMN "setup_fee_brl_cents" INTEGER NOT NULL DEFAULT 0;

-- FK do plano acompanha a coluna opcional
ALTER TABLE "trafego_pending_purchase" DROP CONSTRAINT "trafego_pending_purchase_plan_id_fkey";
ALTER TABLE "trafego_pending_purchase" ADD CONSTRAINT "trafego_pending_purchase_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "trafego_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: TrafegoOrder
ALTER TABLE "trafego_order" ADD COLUMN "has_business_manager" BOOLEAN;
ALTER TABLE "trafego_order" ADD COLUMN "service_fee_percent" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "trafego_order" ADD COLUMN "setup_fee_brl_cents" INTEGER NOT NULL DEFAULT 0;
