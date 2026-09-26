-- CreateEnum
CREATE TYPE "CatalogOrderStatus" AS ENUM ('RECEIVED', 'NEGOTIATING', 'AWAITING_PAYMENT', 'PAID', 'IN_LOGISTICS', 'DELIVERED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CatalogOrderPaymentMethod" AS ENUM ('PIX', 'ASAAS_LINK');

-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'NERP_CATALOG';

-- CreateTable
CREATE TABLE "nerp_catalog_integrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "orders_tracking_id" TEXT NOT NULL,
    "orders_status_id" TEXT,
    "logistics_tracking_id" TEXT NOT NULL,
    "logistics_status_id" TEXT,
    "whatsapp_number" TEXT,
    "asaas_api_key" TEXT,
    "asaas_api_key_last4" TEXT,
    "asaas_env" TEXT NOT NULL DEFAULT 'production',
    "asaas_webhook_id" TEXT,
    "asaas_webhook_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nerp_catalog_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_orders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "nerp_sale_id" TEXT NOT NULL,
    "nerp_sale_number" INTEGER NOT NULL,
    "public_token" TEXT NOT NULL,
    "status" "CatalogOrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "items" JSONB NOT NULL,
    "customer" JSONB NOT NULL,
    "delivery" JSONB NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "shipping" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "catalog_url" TEXT,
    "payment_method" "CatalogOrderPaymentMethod",
    "asaas_payment_id" TEXT,
    "pix_payload" TEXT,
    "pix_qr_image" TEXT,
    "pix_expires_at" TIMESTAMP(3),
    "invoice_url" TEXT,
    "paid_at" TIMESTAMP(3),
    "nerp_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nerp_catalog_integrations_organization_id_key" ON "nerp_catalog_integrations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_orders_nerp_sale_id_key" ON "catalog_orders"("nerp_sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_orders_public_token_key" ON "catalog_orders"("public_token");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_orders_asaas_payment_id_key" ON "catalog_orders"("asaas_payment_id");

-- CreateIndex
CREATE INDEX "catalog_orders_organization_id_status_idx" ON "catalog_orders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "catalog_orders_lead_id_idx" ON "catalog_orders"("lead_id");

-- AddForeignKey
ALTER TABLE "nerp_catalog_integrations" ADD CONSTRAINT "nerp_catalog_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_orders" ADD CONSTRAINT "catalog_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_orders" ADD CONSTRAINT "catalog_orders_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

