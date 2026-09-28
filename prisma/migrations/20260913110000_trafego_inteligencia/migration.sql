-- trafeGO (spec 0009, Fase D): Release da empresa, recomendações e checklist
-- de acessos no painel do cliente. Só adições.

ALTER TABLE "trafego_order"
  ADD COLUMN "release" JSONB,
  ADD COLUMN "release_sources" JSONB,
  ADD COLUMN "release_generated_at" TIMESTAMP(3),
  ADD COLUMN "release_saved_at" TIMESTAMP(3),
  ADD COLUMN "recommendations" JSONB,
  ADD COLUMN "recommendations_generated_at" TIMESTAMP(3),
  ADD COLUMN "access_checklist" JSONB;
