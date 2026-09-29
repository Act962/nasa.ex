-- Spec: specs/astro/0031-astro-chat-widget-no-site.md (TR-4)
--
-- Portão atômico de "1 mensagem a cada 2 s" por visitante do ASTRO CHAT: a
-- checagem por contagem deixava passar requisições simultâneas.
--
-- ADITIVA: uma coluna opcional. ROLLBACK: ALTER TABLE "astro_chat_visitors" DROP COLUMN "last_message_at";

ALTER TABLE "astro_chat_visitors" ADD COLUMN "last_message_at" TIMESTAMP(3);
