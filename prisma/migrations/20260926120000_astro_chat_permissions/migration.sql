-- Spec: specs/astro/0031-astro-chat-widget-no-site.md (RF-14, RF-15, D-14)
--
-- ASTRO CHAT: permissões de dados por assunto e identidade do widget.
--
-- ESTRITAMENTE ADITIVA: quatro colunas opcionais ou com default, todas na
-- tabela do próprio ASTRO CHAT. Nenhuma linha existente muda de comportamento:
-- `blocked_topic_ids` nasce vazio, que significa "nada bloqueado".
--
-- ROLLBACK:
--   ALTER TABLE "astro_chat_sites"
--     DROP COLUMN "avatar_url",
--     DROP COLUMN "widget_theme",
--     DROP COLUMN "blocked_topic_ids",
--     DROP COLUMN "restriction_notes";

ALTER TABLE "astro_chat_sites"
  ADD COLUMN "avatar_url" TEXT,
  ADD COLUMN "widget_theme" TEXT NOT NULL DEFAULT 'light',
  ADD COLUMN "blocked_topic_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "restriction_notes" TEXT;
