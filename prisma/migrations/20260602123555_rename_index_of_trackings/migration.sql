-- RenameIndex
ALTER INDEX "tracking_preset_applications_org_created_idx" RENAME TO "tracking_preset_applications_organization_id_created_at_idx";

-- RenameIndex
ALTER INDEX "tracking_preset_applications_preset_idx" RENAME TO "tracking_preset_applications_preset_id_idx";
