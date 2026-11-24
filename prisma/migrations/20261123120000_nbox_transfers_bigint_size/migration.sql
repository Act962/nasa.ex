-- Spec 0148: transferência com prazo (pasta) e tamanho de arquivo acima de 2 GB.
ALTER TABLE "nbox_folders" ADD COLUMN "expires_at" TIMESTAMP(3);
ALTER TABLE "nbox_folders" ADD COLUMN "share_token" TEXT;

CREATE UNIQUE INDEX "nbox_folders_share_token_key" ON "nbox_folders"("share_token");
CREATE INDEX "nbox_folders_expires_at_idx" ON "nbox_folders"("expires_at");

ALTER TABLE "nbox_items" ALTER COLUMN "size" SET DATA TYPE BIGINT;
