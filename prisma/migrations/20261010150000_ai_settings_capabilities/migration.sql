-- spec 0084 — o que o Chatbot IA pode fazer pelo cliente. Aditiva; vazio = tudo desligado.
-- Rollback: ALTER TABLE "ai_setting" DROP COLUMN "capabilities";

-- AlterTable
ALTER TABLE "ai_setting" ADD COLUMN "capabilities" JSONB NOT NULL DEFAULT '{}';
