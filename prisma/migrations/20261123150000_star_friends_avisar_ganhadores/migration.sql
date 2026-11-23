-- Spec 0148: nomes dos prêmios da campanha e aviso do ganhador pelo WhatsApp. Só adiciona colunas.
ALTER TABLE "loyalty_campaigns" ADD COLUMN "prize_names" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "loyalty_campaign_draws" ADD COLUMN "notified_at" TIMESTAMP(3),
ADD COLUMN "notify_message_id" TEXT,
ADD COLUMN "notify_error" TEXT;
