-- CreateEnum
CREATE TYPE "ForgePriceCategory" AS ENUM ('AI_MODEL', 'WHATSAPP_CONVERSATION', 'INFRA_SERVER', 'HOSTING', 'STORAGE', 'DATABASE', 'LABOR', 'OTHER');

-- CreateEnum
CREATE TYPE "ForgePriceUnit" AS ENUM ('PER_1K_TOKENS', 'PER_CONVERSATION', 'PER_MONTH', 'PER_HOUR', 'PER_GB_MONTH', 'PER_COMPUTE_HOUR', 'FLAT');

-- CreateEnum
CREATE TYPE "ForgePriceCurrency" AS ENUM ('BRL', 'USD');

-- CreateEnum
CREATE TYPE "ForgePriceSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ForgeSimulationMode" AS ENUM ('COMERCIAL', 'LICITACAO');

-- CreateEnum
CREATE TYPE "ForgeExequibilidadeFlag" AS ENUM ('OK', 'EXCESSIVO', 'INEXEQUIVEL');

-- CreateTable
CREATE TABLE "forge_price_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "category" "ForgePriceCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "provider" TEXT,
    "currency" "ForgePriceCurrency" NOT NULL DEFAULT 'BRL',
    "unit" "ForgePriceUnit" NOT NULL,
    "unit_price" DECIMAL(18,8),
    "input_per_1k" DECIMAL(18,8),
    "output_per_1k" DECIMAL(18,8),
    "cached_input_per_1k" DECIMAL(18,8),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_seeded" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forge_price_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forge_price_suggestions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "price_item_id" TEXT,
    "category" "ForgePriceCategory" NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "currency" "ForgePriceCurrency" NOT NULL DEFAULT 'BRL',
    "current_value" JSONB,
    "suggested_value" JSONB NOT NULL,
    "source_url" TEXT,
    "source_label" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ForgePriceSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forge_price_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forge_simulations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "ForgeSimulationMode" NOT NULL DEFAULT 'COMERCIAL',
    "markup_percentage" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "usd_to_brl_rate" DECIMAL(10,4) NOT NULL,
    "internal_cost_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "client_price_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMP(3),
    "proposal_id" TEXT,
    "user_count" INTEGER NOT NULL DEFAULT 1,
    "ai_price_item_id" TEXT,
    "ai_model_code" TEXT,
    "input_tokens_per_user" INTEGER NOT NULL DEFAULT 0,
    "output_tokens_per_user" INTEGER NOT NULL DEFAULT 0,
    "cached_tokens_per_user" INTEGER NOT NULL DEFAULT 0,
    "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_mix" JSONB NOT NULL DEFAULT '[]',
    "bid_org" TEXT,
    "bid_number" TEXT,
    "contract_months" INTEGER NOT NULL DEFAULT 12,
    "ceiling_total_brl" DECIMAL(15,2),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forge_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forge_simulation_line_items" (
    "id" TEXT NOT NULL,
    "simulation_id" TEXT NOT NULL,
    "price_item_id" TEXT,
    "category" "ForgePriceCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" "ForgePriceUnit" NOT NULL,
    "unit_cost_brl" DECIMAL(18,8) NOT NULL,
    "internal_cost" DECIMAL(15,2) NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "forge_simulation_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forge_bid_items" (
    "id" TEXT NOT NULL,
    "simulation_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "price_item_id" TEXT,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'SV',
    "quantity" DECIMAL(15,4) NOT NULL,
    "internal_unit_cost_brl" DECIMAL(18,8) NOT NULL,
    "markup_percentage" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "bid_unit_brl" DECIMAL(15,2) NOT NULL,
    "bid_monthly_brl" DECIMAL(15,2) NOT NULL,
    "bid_total_brl" DECIMAL(15,2) NOT NULL,
    "ceiling_unit_brl" DECIMAL(15,2),
    "exequibilidade" "ForgeExequibilidadeFlag" NOT NULL DEFAULT 'OK',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "forge_bid_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forge_price_items_organization_id_category_idx" ON "forge_price_items"("organization_id", "category");

-- CreateIndex
CREATE INDEX "forge_price_items_organization_id_is_active_idx" ON "forge_price_items"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "forge_price_items_organization_id_category_code_key" ON "forge_price_items"("organization_id", "category", "code");

-- CreateIndex
CREATE INDEX "forge_price_suggestions_organization_id_status_idx" ON "forge_price_suggestions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "forge_simulations_proposal_id_key" ON "forge_simulations"("proposal_id");

-- CreateIndex
CREATE INDEX "forge_simulations_organization_id_idx" ON "forge_simulations"("organization_id");

-- CreateIndex
CREATE INDEX "forge_simulation_line_items_simulation_id_idx" ON "forge_simulation_line_items"("simulation_id");

-- CreateIndex
CREATE INDEX "forge_bid_items_simulation_id_idx" ON "forge_bid_items"("simulation_id");

-- AddForeignKey
ALTER TABLE "forge_price_items" ADD CONSTRAINT "forge_price_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_price_suggestions" ADD CONSTRAINT "forge_price_suggestions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_price_suggestions" ADD CONSTRAINT "forge_price_suggestions_price_item_id_fkey" FOREIGN KEY ("price_item_id") REFERENCES "forge_price_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_simulations" ADD CONSTRAINT "forge_simulations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_simulations" ADD CONSTRAINT "forge_simulations_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "forge_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_simulation_line_items" ADD CONSTRAINT "forge_simulation_line_items_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "forge_simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_simulation_line_items" ADD CONSTRAINT "forge_simulation_line_items_price_item_id_fkey" FOREIGN KEY ("price_item_id") REFERENCES "forge_price_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_bid_items" ADD CONSTRAINT "forge_bid_items_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "forge_simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_bid_items" ADD CONSTRAINT "forge_bid_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "forge_bid_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_bid_items" ADD CONSTRAINT "forge_bid_items_price_item_id_fkey" FOREIGN KEY ("price_item_id") REFERENCES "forge_price_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
