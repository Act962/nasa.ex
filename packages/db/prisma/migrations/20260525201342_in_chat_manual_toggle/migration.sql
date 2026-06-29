-- WhatsAppInstance.inChatModeManual + companions + LeadSource.IN_CHAT
--
-- Sprint 3.5 — Toggle manual do In-Chat (owner/admin/moderador) +
-- página pública sempre acessível + paridade de automações no pipeline.
--
-- Adições:
--  - WhatsAppInstance.inChatModeManual (BOOLEAN, default false)
--  - WhatsAppInstance.inChatManualSetBy (TEXT, nullable) — userId
--  - WhatsAppInstance.inChatManualSetAt (TIMESTAMP, nullable)
--  - Índice em inChatModeManual (lookup do banner)
--  - LeadSource.IN_CHAT — lead criado via página pública /whatsapp/[slug]
--
-- Aplicada via `prisma db execute` + `migrate resolve --applied` pra
-- contornar drift conhecido (mesmo padrão da migration anterior
-- `lead_archive_fields`). IF NOT EXISTS pra idempotência.

ALTER TABLE "whatsapp_instances"
  ADD COLUMN IF NOT EXISTS "in_chat_mode_manual" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "in_chat_manual_set_by" TEXT,
  ADD COLUMN IF NOT EXISTS "in_chat_manual_set_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "whatsapp_instances_in_chat_mode_manual_idx"
  ON "whatsapp_instances"("in_chat_mode_manual");

-- ALTER TYPE ... ADD VALUE não roda em transaction; check primeiro
-- pra rodar idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'IN_CHAT'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'LeadSource')
  ) THEN
    ALTER TYPE "LeadSource" ADD VALUE 'IN_CHAT';
  END IF;
END$$;
