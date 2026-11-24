-- Spec 0148: venda registrada pelo número do cliente e recibo.
CREATE TYPE "ForgePaymentMethod" AS ENUM ('PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'BOLETO');

ALTER TABLE "forge_proposals"
  ADD COLUMN "payment_method" "ForgePaymentMethod",
  ADD COLUMN "installments" INTEGER,
  ADD COLUMN "paid_at" TIMESTAMP(3);

CREATE INDEX "forge_proposals_organization_id_paid_at_idx" ON "forge_proposals"("organization_id", "paid_at");
