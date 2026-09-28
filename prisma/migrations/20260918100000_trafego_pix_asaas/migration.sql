-- Spec 0020 — cobrança PIX pelo Asaas no checkout do trafeGO.
--
-- Aditiva e reversível: todas as colunas são opcionais, e nenhum fluxo
-- anterior lê qualquer uma delas. Desfazer é DROP COLUMN.

ALTER TABLE "trafego_pending_purchase"
  ADD COLUMN "asaas_payment_id"     TEXT,
  ADD COLUMN "asaas_customer_id"    TEXT,
  ADD COLUMN "payer_document"       TEXT,
  ADD COLUMN "pix_qr_code_payload"  TEXT;

-- Uma cobrança do Asaas pertence a uma pendência só. O índice único é o que
-- impede dois eventos concorrentes de amarrarem a mesma cobrança em pedidos
-- diferentes.
CREATE UNIQUE INDEX "trafego_pending_purchase_asaas_payment_id_key"
  ON "trafego_pending_purchase"("asaas_payment_id");
