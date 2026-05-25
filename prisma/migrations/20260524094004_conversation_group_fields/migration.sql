-- Tracking Chat 2.0 — Sprint 1
--
-- Adiciona 2 fields opcionais ao `conversation` pra dar suporte a grupos
-- do WhatsApp na lista de conversas:
--   - `group_subject`            — nome do grupo (vem da uazapi)
--   - `group_participants_count` — contagem pra badge no card
--
-- `isGroup` (boolean default false) já existia no schema.
--
-- Aplicada via `prisma db execute` + `migrate resolve --applied` pra
-- contornar drift conhecido (migrations de outras feature branches já
-- aplicadas localmente). `IF NOT EXISTS` mantém idempotência.

ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "group_subject"            TEXT,
  ADD COLUMN IF NOT EXISTS "group_participants_count" INTEGER;
