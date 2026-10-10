-- Spec 0081: próxima data da ficha e registro do PIX. Colunas opcionais, sem valor padrão:
-- nenhuma ficha existente muda.
ALTER TABLE "form_record"
  ADD COLUMN "next_due_at" TIMESTAMP(3),
  ADD COLUMN "pix_sent_at" TIMESTAMP(3),
  ADD COLUMN "paid_at" TIMESTAMP(3);

CREATE INDEX "form_record_organization_id_next_due_at_idx" ON "form_record"("organization_id", "next_due_at");
