-- Preferências de IA da empresa (spec 0093, etapa 2). Aditiva: uma coluna com padrão vazio.
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "ai_preferences" JSONB NOT NULL DEFAULT '{}';
-- Rollback: ALTER TABLE "organization" DROP COLUMN "ai_preferences";
