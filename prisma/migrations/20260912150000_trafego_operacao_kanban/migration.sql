-- trafeGO (spec 0009, Fase A): operação pelo tracking — card ↔ pedido, briefing no card,
-- avisos ao cliente, financeiro com conta/categoria.
--
-- Só adições: um valor de enum, um enum novo, colunas nullable ou com default,
-- índices e FKs SET NULL. Nada existente muda.

-- AlterEnum: fase de análise da conta de anúncios, entre PAID e ONBOARDING
ALTER TYPE "TrafegoOrderStatus" ADD VALUE 'ACCOUNT_REVIEW';

-- CreateEnum: origem da transição de status
CREATE TYPE "TrafegoTransitionSource" AS ENUM ('KANBAN', 'ADMIN', 'CLIENT', 'SYSTEM');

-- AlterTable: evento ganha origem e carimbo de aviso ao cliente
ALTER TABLE "trafego_order_event" ADD COLUMN "source" "TrafegoTransitionSource";
ALTER TABLE "trafego_order_event" ADD COLUMN "client_notified_at" TIMESTAMP(3);

-- AlterTable: pedido aponta para o card e sabe quando os materiais ficaram prontos
ALTER TABLE "trafego_order" ADD COLUMN "lead_id" TEXT;
ALTER TABLE "trafego_order" ADD COLUMN "materials_submitted_at" TIMESTAMP(3);
CREATE INDEX "trafego_order_lead_id_idx" ON "trafego_order"("lead_id");
ALTER TABLE "trafego_order" ADD CONSTRAINT "trafego_order_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: compra pendente já nasce com card e resposta de briefing
ALTER TABLE "trafego_pending_purchase" ADD COLUMN "lead_id" TEXT;
ALTER TABLE "trafego_pending_purchase" ADD COLUMN "briefing_response_id" TEXT;
CREATE INDEX "trafego_pending_purchase_lead_id_idx" ON "trafego_pending_purchase"("lead_id");
ALTER TABLE "trafego_pending_purchase" ADD CONSTRAINT "trafego_pending_purchase_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: configurações da operação
ALTER TABLE "trafego_settings" ADD COLUMN "operations_tracking_id" TEXT;
ALTER TABLE "trafego_settings" ADD COLUMN "status_column_map" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "trafego_settings" ADD COLUMN "briefing_form_id" TEXT;
ALTER TABLE "trafego_settings" ADD COLUMN "partner_business_id" TEXT;
ALTER TABLE "trafego_settings" ADD COLUMN "whatsapp_activation_template" TEXT;
ALTER TABLE "trafego_settings" ADD COLUMN "whatsapp_status_template" TEXT;
ALTER TABLE "trafego_settings" ADD COLUMN "whatsapp_template_language" TEXT NOT NULL DEFAULT 'pt_BR';
ALTER TABLE "trafego_settings" ADD COLUMN "client_notifications_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "trafego_settings" ADD COLUMN "finance_account_id" TEXT;
ALTER TABLE "trafego_settings" ADD COLUMN "finance_revenue_category_id" TEXT;
ALTER TABLE "trafego_settings" ADD COLUMN "finance_passthrough_category_id" TEXT;
