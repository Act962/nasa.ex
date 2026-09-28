-- spec 0019 — Astro financeiro pelo WhatsApp. Aditiva, default desligado.
-- Rollback: ALTER TABLE "organization_bot_config" DROP COLUMN "finance_enabled";

-- AlterTable
ALTER TABLE "organization_bot_config" ADD COLUMN "finance_enabled" BOOLEAN NOT NULL DEFAULT false;
