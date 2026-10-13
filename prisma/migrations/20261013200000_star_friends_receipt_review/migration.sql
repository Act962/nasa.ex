-- STAR FRIENDS: cupom que a leitura automática não resolveu fica em conferência manual (spec 0102, RF-15). Só aditiva.
ALTER TYPE "LoyaltyReceiptStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
