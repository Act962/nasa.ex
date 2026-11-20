-- FlowAstro: fluxo de atendimento da empresa, ligado a vários números (spec 0139, D-11)
ALTER TABLE "workflows" ADD COLUMN "organization_id" TEXT;
CREATE INDEX "workflows_organization_id_kind_idx" ON "workflows"("organization_id", "kind");
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "workflow_tracking_links" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_tracking_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_tracking_links_workflow_id_tracking_id_key" ON "workflow_tracking_links"("workflow_id", "tracking_id");
CREATE INDEX "workflow_tracking_links_tracking_id_idx" ON "workflow_tracking_links"("tracking_id");
ALTER TABLE "workflow_tracking_links" ADD CONSTRAINT "workflow_tracking_links_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_tracking_links" ADD CONSTRAINT "workflow_tracking_links_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
