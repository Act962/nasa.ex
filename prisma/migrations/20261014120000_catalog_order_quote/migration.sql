-- Spec 0103: valor do pedido do catálogo negociado pelo atendente e aprovado pelo cliente.
ALTER TABLE "catalog_orders" ADD COLUMN "quote_requested_at" TIMESTAMP(3);
ALTER TABLE "catalog_orders" ADD COLUMN "quoted_at" TIMESTAMP(3);
ALTER TABLE "catalog_orders" ADD COLUMN "quoted_by_id" TEXT;
ALTER TABLE "catalog_orders" ADD COLUMN "quote_approved_at" TIMESTAMP(3);
