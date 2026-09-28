-- spec 0016 — extrato PDF lido pelo Astro. Aditiva.
-- Rollback: valor de enum não é removível no Postgres sem recriar o tipo.

-- AlterEnum
ALTER TYPE "PaymentBankTxSource" ADD VALUE 'PDF_UPLOAD';
