-- spec 0083 — Astro responde em áudio no WhatsApp. Aditiva, padrão desligado.
-- Rollback:
--   ALTER TABLE "organization_bot_config" DROP COLUMN "voice_reply_mode", DROP COLUMN "voice_name", DROP COLUMN "voice_also_text";
--   ALTER TABLE "whatsapp_bot_command" DROP COLUMN "replied_with_voice", DROP COLUMN "voice_stars_charged";

-- AlterTable
ALTER TABLE "organization_bot_config"
  ADD COLUMN "voice_reply_mode" TEXT NOT NULL DEFAULT 'off',
  ADD COLUMN "voice_name" TEXT,
  ADD COLUMN "voice_also_text" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "whatsapp_bot_command"
  ADD COLUMN "replied_with_voice" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "voice_stars_charged" INTEGER;
