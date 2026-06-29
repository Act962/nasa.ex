-- Preferências visuais do chat por USUÁRIO (não por org).
-- Cada atendente customiza fundo + cores das bolhas independentemente.
-- Idempotente (IF NOT EXISTS) — seguro pra rodar várias vezes.

CREATE TABLE IF NOT EXISTS "user_chat_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_background_type" TEXT NOT NULL DEFAULT 'default',
    "chat_background_value" TEXT,
    "own_message_bg_color" TEXT,
    "their_message_bg_color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_chat_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_chat_preferences_user_id_key" ON "user_chat_preferences"("user_id");

DO $$ BEGIN
  ALTER TABLE "user_chat_preferences" ADD CONSTRAINT "user_chat_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
