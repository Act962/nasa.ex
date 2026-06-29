-- CreateEnum
CREATE TYPE "ForgeProposalStatus" AS ENUM ('RASCUNHO', 'ENVIADA', 'VISUALIZADA', 'PAGA', 'EXPIRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ForgeContractStatus" AS ENUM ('ATIVO', 'ENCERRADO', 'CANCELADO', 'PENDENTE_ASSINATURA');

-- CreateEnum
CREATE TYPE "ForgePaymentGateway" AS ENUM ('STRIPE', 'ASAAS', 'PAGBANK', 'PAGSEGURO', 'MERCADOPAGO', 'BANCO_DO_BRASIL', 'CAIXA_ECONOMICA', 'PIX');

-- CreateEnum
CREATE TYPE "ForgeDiscountType" AS ENUM ('PERCENTUAL', 'FIXO');

-- CreateEnum
CREATE TYPE "ForgeSecurityLevel" AS ENUM ('PUBLICO', 'PRIVADO', 'TWO_FA');

-- CreateTable
CREATE TABLE "forge_products" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "image_url" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'un',
    "description" TEXT,
    "value" DECIMAL(15,2) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forge_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forge_proposals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "ForgeProposalStatus" NOT NULL DEFAULT 'RASCUNHO',
    "client_id" TEXT,
    "responsible_id" TEXT NOT NULL,
    "participants" TEXT[],
    "valid_until" TIMESTAMP(3),
    "description" TEXT,
    "discount" DECIMAL(15,2),
    "discount_type" "ForgeDiscountType",
    "payment_link" TEXT,
    "payment_gateway" "ForgePaymentGateway",
    "public_token" TEXT NOT NULL,
    "header_config" JSONB NOT NULL DEFAULT '{}',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forge_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forge_proposal_products" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL DEFAULT 1,
    "unit_value" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2),
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "forge_proposal_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forge_contracts" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT,
    "organization_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "status" "ForgeContractStatus" NOT NULL DEFAULT 'PENDENTE_ASSINATURA',
    "template_id" TEXT,
    "content" TEXT,
    "signers" JSONB NOT NULL DEFAULT '[]',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forge_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forge_contract_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forge_contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forge_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "commission_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "letterhead_header" TEXT,
    "letterhead_footer" TEXT,
    "logo_url" TEXT,
    "proposal_bg_color" TEXT NOT NULL DEFAULT '#ffffff',
    "proposal_bg_image" TEXT,
    "security_level" "ForgeSecurityLevel" NOT NULL DEFAULT 'PUBLICO',
    "reminder_days_before" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forge_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forge_products_organization_id_idx" ON "forge_products"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "forge_products_organization_id_sku_key" ON "forge_products"("organization_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "forge_proposals_public_token_key" ON "forge_proposals"("public_token");

-- CreateIndex
CREATE INDEX "forge_proposals_organization_id_idx" ON "forge_proposals"("organization_id");

-- CreateIndex
CREATE INDEX "forge_proposals_client_id_idx" ON "forge_proposals"("client_id");

-- CreateIndex
CREATE INDEX "forge_proposals_status_idx" ON "forge_proposals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "forge_proposals_organization_id_number_key" ON "forge_proposals"("organization_id", "number");

-- CreateIndex
CREATE INDEX "forge_proposal_products_proposal_id_idx" ON "forge_proposal_products"("proposal_id");

-- CreateIndex
CREATE INDEX "forge_contracts_organization_id_idx" ON "forge_contracts"("organization_id");

-- CreateIndex
CREATE INDEX "forge_contracts_proposal_id_idx" ON "forge_contracts"("proposal_id");

-- CreateIndex
CREATE INDEX "forge_contracts_status_idx" ON "forge_contracts"("status");

-- CreateIndex
CREATE INDEX "forge_contract_templates_organization_id_idx" ON "forge_contract_templates"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "forge_settings_organization_id_key" ON "forge_settings"("organization_id");

-- AddForeignKey
ALTER TABLE "forge_products" ADD CONSTRAINT "forge_products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_products" ADD CONSTRAINT "forge_products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_proposals" ADD CONSTRAINT "forge_proposals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_proposals" ADD CONSTRAINT "forge_proposals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_proposals" ADD CONSTRAINT "forge_proposals_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_proposals" ADD CONSTRAINT "forge_proposals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_proposal_products" ADD CONSTRAINT "forge_proposal_products_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "forge_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_proposal_products" ADD CONSTRAINT "forge_proposal_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "forge_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_contracts" ADD CONSTRAINT "forge_contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_contracts" ADD CONSTRAINT "forge_contracts_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "forge_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_contracts" ADD CONSTRAINT "forge_contracts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "forge_contract_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_contracts" ADD CONSTRAINT "forge_contracts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_contract_templates" ADD CONSTRAINT "forge_contract_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_contract_templates" ADD CONSTRAINT "forge_contract_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_settings" ADD CONSTRAINT "forge_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
