-- Agenda em níveis (spec 0099, parte C). Aditiva: três colunas opcionais, sem valor padrão.
ALTER TABLE "agendas" ADD COLUMN IF NOT EXISTS "specialty" TEXT;
ALTER TABLE "agendas" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "agendas" ADD COLUMN IF NOT EXISTS "professional_notes" TEXT;
-- Rollback: ALTER TABLE "agendas" DROP COLUMN "specialty", DROP COLUMN "unit", DROP COLUMN "professional_notes";
