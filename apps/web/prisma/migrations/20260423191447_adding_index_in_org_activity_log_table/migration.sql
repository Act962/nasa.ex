-- CreateIndex
CREATE INDEX "org_activity_log_organization_id_resource_resource_id_creat_idx" ON "org_activity_log"("organization_id", "resource", "resource_id", "created_at");
