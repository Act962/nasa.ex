-- Lead.isArchived + Lead.archivedAt
--
-- Toggle de arquivamento que controla visibilidade no /tracking-chat:
-- - isArchived=true ⟶ some da lista padrão, aparece só no filtro "Arquivados"
-- - isArchived=false (default) ⟶ comportamento atual
--
-- Aplicada via `prisma db execute` + `migrate resolve --applied` pra
-- contornar drift conhecido. IF NOT EXISTS pra idempotência.

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
