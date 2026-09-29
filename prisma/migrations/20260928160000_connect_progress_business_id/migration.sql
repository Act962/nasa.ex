-- Spec 0040 (RF-15): portfólio do cliente tirado do link do app, para os links do guia abrirem direto nele.
ALTER TABLE "whatsapp_connect_progress" ADD COLUMN IF NOT EXISTS "draft_business_id" TEXT;
