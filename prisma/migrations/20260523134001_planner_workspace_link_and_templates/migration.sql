-- NASA Planner 2.0 — brand kit + workspace link + post templates
--
-- Adiciona:
--  1. 6 campos de brand kit consolidado em `organization` (paleta hex,
--     fonts heading/body, logo URL + variantes, timestamp da última
--     extração via Claude Vision).
--  2. 4 campos em `nasa_planner_posts`: `action_id` (FK pra workspace
--     action quando post é criado via "Criar com Planner"), `template_id`
--     (FK pro template estático aplicado), `video_transcription_data`
--     (words + chapters + highlights do AssemblyAI — sprint 2) e
--     `video_edit_timeline_json` (timeline completa do editor CapCut
--     pra render via Remotion Lambda — sprint 3).
--  3. Tabela nova `nasa_planner_post_templates` (templates Konva
--     brandeáveis com ratio, layout JSON e preview).
--
-- IMPORTANTE: esta migration foi aplicada via `prisma db execute` +
-- `prisma migrate resolve --applied` em vez de `prisma migrate dev`
-- devido a um conflito pré-existente no main (consolidated PR #246
-- tenta adicionar `archived_at` que já estava em `20260406160000`).
-- Bypass não causa data loss — só pula a validação do shadow DB.

-- AlterTable: organization — campos do brand kit consolidado
ALTER TABLE "organization"
  ADD COLUMN IF NOT EXISTS "brand_palette_hex"   JSONB,
  ADD COLUMN IF NOT EXISTS "brand_font_heading"  TEXT,
  ADD COLUMN IF NOT EXISTS "brand_font_body"     TEXT,
  ADD COLUMN IF NOT EXISTS "brand_logo_url"      TEXT,
  ADD COLUMN IF NOT EXISTS "brand_logo_variants" JSONB,
  ADD COLUMN IF NOT EXISTS "brand_extracted_at"  TIMESTAMP(3);

-- AlterTable: nasa_planner_posts — vínculo com workspace + templates + dados de vídeo
ALTER TABLE "nasa_planner_posts"
  ADD COLUMN IF NOT EXISTS "action_id"                TEXT,
  ADD COLUMN IF NOT EXISTS "template_id"              TEXT,
  ADD COLUMN IF NOT EXISTS "video_transcription_data" JSONB,
  ADD COLUMN IF NOT EXISTS "video_edit_timeline_json" JSONB;

-- CreateTable: nasa_planner_post_templates
CREATE TABLE IF NOT EXISTS "nasa_planner_post_templates" (
  "id"              TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "slug"            TEXT NOT NULL,
  "category"        TEXT NOT NULL,
  "ratio"           TEXT NOT NULL,
  "layoutJson"      JSONB NOT NULL,
  "preview_key"     TEXT,
  "is_global"       BOOLEAN NOT NULL DEFAULT false,
  "organization_id" TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "nasa_planner_post_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes — templates
CREATE UNIQUE INDEX IF NOT EXISTS "nasa_planner_post_templates_slug_key"
  ON "nasa_planner_post_templates"("slug");
CREATE INDEX IF NOT EXISTS "nasa_planner_post_templates_organization_id_is_global_idx"
  ON "nasa_planner_post_templates"("organization_id", "is_global");
CREATE INDEX IF NOT EXISTS "nasa_planner_post_templates_category_idx"
  ON "nasa_planner_post_templates"("category");

-- CreateIndexes — posts (action_id + template_id)
CREATE INDEX IF NOT EXISTS "nasa_planner_posts_action_id_idx"
  ON "nasa_planner_posts"("action_id");
CREATE INDEX IF NOT EXISTS "nasa_planner_posts_template_id_idx"
  ON "nasa_planner_posts"("template_id");

-- AddForeignKey: nasa_planner_posts.action_id → actions.id (SetNull on delete)
-- NOTA: nome da tabela é "actions" (plural) no banco — confirmar via \dt
DO $$ BEGIN
  ALTER TABLE "nasa_planner_posts"
    ADD CONSTRAINT "nasa_planner_posts_action_id_fkey"
    FOREIGN KEY ("action_id") REFERENCES "actions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: nasa_planner_posts.template_id → nasa_planner_post_templates.id
DO $$ BEGIN
  ALTER TABLE "nasa_planner_posts"
    ADD CONSTRAINT "nasa_planner_posts_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "nasa_planner_post_templates"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: nasa_planner_post_templates.organization_id → organization.id
DO $$ BEGIN
  ALTER TABLE "nasa_planner_post_templates"
    ADD CONSTRAINT "nasa_planner_post_templates_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
