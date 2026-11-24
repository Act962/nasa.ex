-- Link de envio de arquivos para cliente sem conta (spec 0149)
ALTER TABLE "nbox_folders" ADD COLUMN "upload_token" TEXT;
ALTER TABLE "nbox_folders" ADD COLUMN "upload_expires_at" TIMESTAMP(3);
CREATE UNIQUE INDEX "nbox_folders_upload_token_key" ON "nbox_folders"("upload_token");

ALTER TABLE "nbox_items" ADD COLUMN "uploader_token_hash" TEXT;
CREATE INDEX "nbox_items_folder_id_uploader_token_hash_idx" ON "nbox_items"("folder_id", "uploader_token_hash");
