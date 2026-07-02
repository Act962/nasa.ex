-- Fase 9 (WhatsApp Oficial): status ticks (#4).
-- Adiciona DELIVERED e FAILED ao enum MessageStatus (aditivo).
-- DELIVERED entre SENT e SEEN; FAILED após SEEN.
ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'DELIVERED' AFTER 'SENT';
ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'FAILED' AFTER 'SEEN';
