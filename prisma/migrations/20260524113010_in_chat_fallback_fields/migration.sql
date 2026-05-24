-- In-Chat Fallback: campos pra modo anti-ban
-- - WhatsAppInstance: flags pra ativar o modo + contador de falhas + timestamp
-- - Message: flag indicando se a mensagem trafegou via página pública (não uazapi)

ALTER TABLE "whatsapp_instances"
  ADD COLUMN "in_chat_mode_active" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "in_chat_activated_at" TIMESTAMP(3),
  ADD COLUMN "in_chat_failure_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "whatsapp_instances_in_chat_mode_active_idx"
  ON "whatsapp_instances"("in_chat_mode_active");

ALTER TABLE "messages"
  ADD COLUMN "via_in_chat" BOOLEAN NOT NULL DEFAULT false;
