-- CreateEnum
CREATE TYPE "LoyaltyRewardType" AS ENUM ('PRODUCT', 'DISCOUNT', 'PRIZE');

-- CreateEnum
CREATE TYPE "LoyaltyLedgerType" AS ENUM ('EARN', 'REDEEM', 'ADJUST_CREDIT', 'ADJUST_DEBIT', 'EXPIRE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "LoyaltyLedgerSource" AS ENUM ('CATALOG_ORDER', 'FORGE_PROPOSAL', 'MANUAL', 'REDEMPTION');

-- CreateEnum
CREATE TYPE "LoyaltyActorType" AS ENUM ('USER', 'SYSTEM', 'ASTRO', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "LoyaltyRedemptionStatus" AS ENUM ('PENDING', 'APPROVED', 'DELIVERED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "LoyaltyRedemptionChannel" AS ENUM ('CONSULTANT', 'CHAT', 'ASTRO', 'PORTAL');

-- CreateTable
CREATE TABLE "loyalty_programs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL DEFAULT 'STAR FRIENDS',
    "stars_per_purchase" INTEGER NOT NULL DEFAULT 1,
    "min_purchase_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stars_expire_days" INTEGER,
    "count_catalog_orders" BOOLEAN NOT NULL DEFAULT true,
    "count_forge_proposals" BOOLEAN NOT NULL DEFAULT true,
    "rules" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_rewards" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "LoyaltyRewardType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "cost_stars" INTEGER NOT NULL,
    "discount_value" DECIMAL(12,2),
    "discount_percent" INTEGER,
    "stock" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "last_lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_ledger_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "type" "LoyaltyLedgerType" NOT NULL,
    "stars" INTEGER NOT NULL,
    "source" "LoyaltyLedgerSource" NOT NULL,
    "source_id" TEXT NOT NULL,
    "items_snapshot" JSONB,
    "reason" TEXT,
    "actor_type" "LoyaltyActorType" NOT NULL,
    "actor_user_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_redemptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "reward_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "status" "LoyaltyRedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "cost_stars" INTEGER NOT NULL,
    "reward_snapshot" JSONB NOT NULL,
    "requested_via" "LoyaltyRedemptionChannel" NOT NULL,
    "requested_by_type" "LoyaltyActorType" NOT NULL,
    "requested_by_user_id" TEXT,
    "requested_by_name" TEXT NOT NULL,
    "note" TEXT,
    "decided_by_user_id" TEXT,
    "decided_by_name" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_reason" TEXT,
    "delivered_by_user_id" TEXT,
    "delivered_by_name" TEXT,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_organization_id_key" ON "loyalty_programs"("organization_id");

-- CreateIndex
CREATE INDEX "loyalty_rewards_organization_id_is_active_idx" ON "loyalty_rewards"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_members_organization_id_phone_key" ON "loyalty_members"("organization_id", "phone");

-- CreateIndex
CREATE INDEX "loyalty_ledger_entries_organization_id_created_at_idx" ON "loyalty_ledger_entries"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_ledger_entries_member_id_created_at_idx" ON "loyalty_ledger_entries"("member_id", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_ledger_entries_actor_user_id_idx" ON "loyalty_ledger_entries"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_ledger_entries_source_source_id_type_key" ON "loyalty_ledger_entries"("source", "source_id", "type");

-- CreateIndex
CREATE INDEX "loyalty_redemptions_organization_id_status_idx" ON "loyalty_redemptions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "loyalty_redemptions_member_id_idx" ON "loyalty_redemptions"("member_id");

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_members" ADD CONSTRAINT "loyalty_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_ledger_entries" ADD CONSTRAINT "loyalty_ledger_entries_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "loyalty_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "loyalty_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "loyalty_rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

