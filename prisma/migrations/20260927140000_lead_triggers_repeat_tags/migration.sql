-- Gatilho do lead: repetição a cada X dias, número de repetições e filtro por tags (spec 0038).
ALTER TABLE "lead_triggers" ADD COLUMN IF NOT EXISTS "repeat_every_days" INTEGER;
ALTER TABLE "lead_triggers" ADD COLUMN IF NOT EXISTS "max_repetitions" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "lead_triggers" ADD COLUMN IF NOT EXISTS "cycle_fire_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lead_triggers" ADD COLUMN IF NOT EXISTS "tag_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
