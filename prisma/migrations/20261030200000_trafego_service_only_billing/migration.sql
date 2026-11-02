-- Spec 0123: trafeGO cobra só o serviço; a verba é paga pelo cliente direto à Meta.
ALTER TABLE "trafego_pending_purchase" ADD COLUMN "ad_budget_paid_to_meta" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trafego_order" ADD COLUMN "ad_budget_paid_to_meta" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trafego_order" ADD COLUMN "meta_campaign_ids_outside_service" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
