-- Pastas pra agrupar workflows dentro de um tracking. Workflow ganha
-- coluna `folder_id` opcional (NULL = "Sem pasta"). Pasta com workflows
-- dentro não pode ser deletada — a validação é feita no oRPC handler
-- (não via constraint do banco, porque queremos uma mensagem amigável
-- pro usuário ao invés de erro genérico de FK).

-- Tabela de pastas
CREATE TABLE IF NOT EXISTS "workflow_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_folders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workflow_folders_tracking_id_idx" ON "workflow_folders"("tracking_id");

-- FKs
DO $$ BEGIN
  ALTER TABLE "workflow_folders" ADD CONSTRAINT "workflow_folders_tracking_id_fkey"
    FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_folders" ADD CONSTRAINT "workflow_folders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Coluna folder_id em workflows
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "folder_id" TEXT;

CREATE INDEX IF NOT EXISTS "workflows_folder_id_idx" ON "workflows"("folder_id");

-- FK workflow → folder (SET NULL on delete: se admin forçar delete da
-- pasta via SQL, workflows ficam "Sem pasta" ao invés de sumirem).
DO $$ BEGIN
  ALTER TABLE "workflows" ADD CONSTRAINT "workflows_folder_id_fkey"
    FOREIGN KEY ("folder_id") REFERENCES "workflow_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
