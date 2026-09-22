-- Captura de lead no passo Contato do wizard (spec 0021)
-- Destino do lead captado ANTES do pagamento. Separado de operations_tracking_id
-- de propósito: aquele board é a mesa do gestor (um card por pedido pago); este
-- é o funil comercial, e pode viver em outra organização.
-- Os três nulos = captura desligada, o wizard se comporta como antes.
ALTER TABLE "trafego_settings"
  ADD COLUMN IF NOT EXISTS "capture_organization_id" TEXT,
  ADD COLUMN IF NOT EXISTS "capture_tracking_id" TEXT,
  ADD COLUMN IF NOT EXISTS "capture_status_id" TEXT;
