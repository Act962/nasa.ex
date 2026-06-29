-- CreateEnum
CREATE TYPE "StarTransactionType" AS ENUM ('PLAN_CREDIT', 'TOPUP_PURCHASE', 'APP_CHARGE', 'APP_SETUP', 'ROLLOVER', 'MANUAL_ADJUST', 'REFUND');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "plan_id" TEXT,
ADD COLUMN     "stars_alert_config" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "stars_balance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stars_cycle_start" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_stars" INTEGER NOT NULL,
    "price_monthly" DECIMAL(10,2) NOT NULL,
    "max_users" INTEGER NOT NULL DEFAULT 3,
    "rollover_pct" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "star_packages" (
    "id" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "price_brl" DECIMAL(10,2) NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "star_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_star_costs" (
    "id" TEXT NOT NULL,
    "app_slug" TEXT NOT NULL,
    "monthly_cost" INTEGER NOT NULL DEFAULT 0,
    "setup_cost" INTEGER NOT NULL DEFAULT 0,
    "price_brl" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_star_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "star_transactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "StarTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "app_slug" TEXT,
    "package_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "star_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_integrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "app_slug" TEXT NOT NULL,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_charged_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "workspace_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "app_star_costs_app_slug_key" ON "app_star_costs"("app_slug");

-- CreateIndex
CREATE INDEX "star_transactions_organization_id_created_at_idx" ON "star_transactions"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "star_transactions_type_idx" ON "star_transactions"("type");

-- CreateIndex
CREATE INDEX "workspace_integrations_organization_id_idx" ON "workspace_integrations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_integrations_organization_id_app_slug_key" ON "workspace_integrations"("organization_id", "app_slug");

-- AddForeignKey
ALTER TABLE "organization" ADD CONSTRAINT "organization_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "star_transactions" ADD CONSTRAINT "star_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
