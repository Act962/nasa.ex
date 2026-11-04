-- "Enviar cobrança agora": cada envio manual ganha o próprio registro. Os avisos da régua
-- continuam com manual_key vazio, um só por conta e etapa.
ALTER TABLE "payment_dunning_executions"
  ADD COLUMN "manual_key" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "manual_by_user_id" TEXT;

DROP INDEX "payment_dunning_executions_entry_id_step_id_key";

CREATE UNIQUE INDEX "payment_dunning_executions_entry_id_step_id_manual_key_key"
  ON "payment_dunning_executions"("entry_id", "step_id", "manual_key");

CREATE INDEX "payment_dunning_executions_entry_id_status_idx"
  ON "payment_dunning_executions"("entry_id", "status");
