-- trafeGO (spec 0009, Fase B-2): PIX manual — o cliente paga numa chave nossa,
-- manda o comprovante pelo WhatsApp e a equipe confirma.
-- Só adições: enum novo, colunas nullable ou com default, índice e FK SET NULL.

CREATE TYPE "TrafegoPaymentMethod" AS ENUM ('CARD', 'PIX');

ALTER TABLE "trafego_pending_purchase"
  ADD COLUMN "payment_method" "TrafegoPaymentMethod" NOT NULL DEFAULT 'CARD',
  ADD COLUMN "pix_reference" TEXT,
  ADD COLUMN "pix_expires_at" TIMESTAMP(3),
  ADD COLUMN "pix_confirmed_at" TIMESTAMP(3),
  ADD COLUMN "pix_confirmed_by_user_id" TEXT,
  ADD COLUMN "pix_received_brl_cents" INTEGER,
  ADD COLUMN "pix_confirmation_note" TEXT;

CREATE UNIQUE INDEX "trafego_pending_purchase_pix_reference_key"
  ON "trafego_pending_purchase"("pix_reference");
CREATE INDEX "trafego_pending_purchase_status_payment_method_idx"
  ON "trafego_pending_purchase"("status", "payment_method");
ALTER TABLE "trafego_pending_purchase"
  ADD CONSTRAINT "trafego_pending_purchase_pix_confirmed_by_user_id_fkey"
  FOREIGN KEY ("pix_confirmed_by_user_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "trafego_order"
  ADD COLUMN "payment_method" "TrafegoPaymentMethod" NOT NULL DEFAULT 'CARD';

ALTER TABLE "trafego_settings"
  ADD COLUMN "pix_key" TEXT,
  ADD COLUMN "pix_holder_name" TEXT,
  ADD COLUMN "pix_bank_name" TEXT,
  ADD COLUMN "pix_expiry_hours" INTEGER NOT NULL DEFAULT 48;
