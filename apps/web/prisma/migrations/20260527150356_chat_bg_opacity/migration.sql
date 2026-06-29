-- Transparência da imagem de fundo do chat (0-100). Aditivo, default 100
-- (opaco) preserva comportamento atual de usuários que já tinham imagem.
ALTER TABLE "user_chat_preferences"
  ADD COLUMN IF NOT EXISTS "chat_background_opacity" INTEGER NOT NULL DEFAULT 100;
