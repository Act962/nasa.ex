-- Spec 0040 (RF-11/RF-12): app Meta do próprio cliente e PIN de duas etapas cifrado.
ALTER TABLE "whatsapp_instances" ADD COLUMN IF NOT EXISTS "meta_app_id" TEXT;
ALTER TABLE "whatsapp_instances" ADD COLUMN IF NOT EXISTS "meta_two_step_pin" TEXT;

-- Spec 0040 (RF-14): progresso do assistente salvo no banco, por funil.
CREATE TABLE IF NOT EXISTS "whatsapp_connect_progress" (
  "id" TEXT NOT NULL,
  "tracking_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "guide_slug" TEXT,
  "done_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "number_source" TEXT,
  "salvy_number_id" TEXT,
  "draft_access_token" TEXT,
  "draft_app_id" TEXT,
  "draft_app_secret" TEXT,
  "updated_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_connect_progress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_connect_progress_tracking_id_key" ON "whatsapp_connect_progress"("tracking_id");
CREATE INDEX IF NOT EXISTS "whatsapp_connect_progress_organization_id_idx" ON "whatsapp_connect_progress"("organization_id");
DO $$ BEGIN
  ALTER TABLE "whatsapp_connect_progress" ADD CONSTRAINT "whatsapp_connect_progress_tracking_id_fkey"
    FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
