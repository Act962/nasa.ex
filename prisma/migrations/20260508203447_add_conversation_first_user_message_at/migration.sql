-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "first_user_message_at" TIMESTAMP(3);

-- Backfill: marca conversas existentes que já tiveram mensagem do usuário com
-- o timestamp da primeira fromMe=true. Evita disparar o gatilho
-- FIRST_CHAT_INTERACTION em conversas antigas após o deploy.
UPDATE "conversations" c
SET "first_user_message_at" = m."first_at"
FROM (
  SELECT "conversationId", MIN("created_at") AS "first_at"
  FROM "messages"
  WHERE "from_me" = true
  GROUP BY "conversationId"
) m
WHERE c."id" = m."conversationId";
