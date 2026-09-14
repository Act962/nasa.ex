-- trafeGO (spec 0009, Fase B-4): prazo realista aceito antes do pagamento.
-- Só adições: colunas nullable.

ALTER TABLE "trafego_pending_purchase"
  ADD COLUMN "desired_start_at" TIMESTAMP(3),
  ADD COLUMN "earliest_start_at" TIMESTAMP(3),
  ADD COLUMN "start_acknowledged_at" TIMESTAMP(3),
  ADD COLUMN "has_social_linked" BOOLEAN,
  ADD COLUMN "materials_ready" BOOLEAN;

ALTER TABLE "trafego_order"
  ADD COLUMN "desired_start_at" TIMESTAMP(3),
  ADD COLUMN "earliest_start_at" TIMESTAMP(3),
  ADD COLUMN "start_acknowledged_at" TIMESTAMP(3),
  ADD COLUMN "has_social_linked" BOOLEAN,
  ADD COLUMN "materials_ready" BOOLEAN;
