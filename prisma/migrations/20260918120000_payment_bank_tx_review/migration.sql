-- Conferência da conciliação (spec: financeiro #3)
-- Marca manual "Conferido" + resultado da leitura do comprovante pela IA (Astro).
ALTER TABLE "payment_bank_transactions"
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewed_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "review_result" JSONB;
