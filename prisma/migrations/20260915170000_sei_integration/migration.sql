ALTER TYPE "IntegrationPlatform" ADD VALUE IF NOT EXISTS 'SEI';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'SEI_ACTION';

CREATE TABLE "sei_process_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "protocolo_procedimento" TEXT NOT NULL,
    "id_procedimento" TEXT,
    "especificacao" TEXT,
    "tipo_procedimento" TEXT,
    "nivel_acesso" TEXT,
    "ultimo_andamento" TEXT,
    "link_acesso" TEXT,
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sei_process_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sei_process_links_lead_id_protocolo_procedimento_key"
ON "sei_process_links"("lead_id", "protocolo_procedimento");

CREATE INDEX "sei_process_links_organization_id_protocolo_procedimento_idx"
ON "sei_process_links"("organization_id", "protocolo_procedimento");

CREATE INDEX "sei_process_links_lead_id_updated_at_idx"
ON "sei_process_links"("lead_id", "updated_at" DESC);

ALTER TABLE "sei_process_links"
ADD CONSTRAINT "sei_process_links_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sei_process_links"
ADD CONSTRAINT "sei_process_links_lead_id_fkey"
FOREIGN KEY ("lead_id") REFERENCES "lead"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
