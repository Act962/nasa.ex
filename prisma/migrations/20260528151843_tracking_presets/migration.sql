-- Tracking Presets: catálogo NASA de padrões prontos pra aplicar em orgs.
-- Migration aditiva: novos enum + 2 tabelas. Sem mudança em tables existentes.
-- Idempotente via IF NOT EXISTS pra rodar em qualquer ambiente sem drama.

-- Enum: paradigmas de atendimento (Reativo/Proativo/Preditivo/Autoatendimento)
DO $$ BEGIN
  CREATE TYPE "TrackingPresetParadigm" AS ENUM (
    'REATIVO',
    'PROATIVO',
    'PREDITIVO',
    'AUTOATENDIMENTO'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Catálogo curado pela equipe NASA. spec JSON contém toda a estrutura do
-- tracking (status, tags, workflows com nodes referenciando slugs).
CREATE TABLE IF NOT EXISTS "tracking_presets" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "paradigm"    "TrackingPresetParadigm" NOT NULL,
  "icon"        TEXT,
  "color"       TEXT,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "spec"        JSONB NOT NULL,
  "is_public"   BOOLEAN NOT NULL DEFAULT true,
  "stars_cost"  INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tracking_presets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tracking_presets_slug_key" ON "tracking_presets"("slug");
CREATE INDEX IF NOT EXISTS "tracking_presets_paradigm_order_idx" ON "tracking_presets"("paradigm", "order");

-- Auditoria de aplicações. Permite analytics e forensics.
CREATE TABLE IF NOT EXISTS "tracking_preset_applications" (
  "id"              TEXT NOT NULL,
  "preset_id"       TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tracking_id"     TEXT NOT NULL,
  "applied_by_id"   TEXT,
  "mode"            TEXT NOT NULL,
  "result"          JSONB NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tracking_preset_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tracking_preset_applications_org_created_idx"
  ON "tracking_preset_applications"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "tracking_preset_applications_preset_idx"
  ON "tracking_preset_applications"("preset_id");

-- FKs com onDelete adequado: Cascade pra preset/org/tracking (lifecycle bound),
-- SetNull pra user (preservar histórico se user for deletado).
DO $$ BEGIN
  ALTER TABLE "tracking_preset_applications"
    ADD CONSTRAINT "tracking_preset_applications_preset_id_fkey"
    FOREIGN KEY ("preset_id") REFERENCES "tracking_presets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "tracking_preset_applications"
    ADD CONSTRAINT "tracking_preset_applications_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "tracking_preset_applications"
    ADD CONSTRAINT "tracking_preset_applications_tracking_id_fkey"
    FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "tracking_preset_applications"
    ADD CONSTRAINT "tracking_preset_applications_applied_by_id_fkey"
    FOREIGN KEY ("applied_by_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
