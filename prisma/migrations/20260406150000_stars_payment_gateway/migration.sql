-- Migration: 20260406150000_stars_payment_gateway
-- Applied via: prisma migrate resolve --applied (tables already exist via db push)

-- CreateTable
CREATE TABLE "payment_gateway_config" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT,
    "secretKey" TEXT NOT NULL,
    "publicKey" TEXT,
    "webhookSecret" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateway_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stars_payment" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "stars_amount" INTEGER NOT NULL,
    "amount_brl" DECIMAL(65,30) NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "gateway_id" TEXT,

    CONSTRAINT "stars_payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stars_payment_user_id_idx" ON "stars_payment"("user_id");

-- CreateIndex
CREATE INDEX "stars_payment_organization_id_idx" ON "stars_payment"("organization_id");

-- CreateIndex
CREATE INDEX "stars_payment_external_id_idx" ON "stars_payment"("external_id");

-- CreateIndex
CREATE INDEX "stars_payment_status_idx" ON "stars_payment"("status");

-- AddForeignKey
ALTER TABLE "stars_payment" ADD CONSTRAINT "stars_payment_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "payment_gateway_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: add updated_at to member_star_budgets (previously missing default)
ALTER TABLE "member_star_budgets" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);
