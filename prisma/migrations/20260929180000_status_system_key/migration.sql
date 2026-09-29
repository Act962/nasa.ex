-- Spec 0044: chave de sistema da coluna (etapas padrão do pedido do catálogo). Aditiva, sem backfill.
ALTER TABLE "status" ADD COLUMN "system_key" TEXT;

CREATE UNIQUE INDEX "status_tracking_id_system_key_key" ON "status"("tracking_id", "system_key");
