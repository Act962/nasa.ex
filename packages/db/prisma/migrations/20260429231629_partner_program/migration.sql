-- CreateEnum
CREATE TYPE "PartnerTier" AS ENUM ('SUITE', 'EARTH', 'GALAXY', 'CONSTELLATION', 'INFINITY');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('ELIGIBLE', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PartnerCommissionStatus" AS ENUM ('PENDING', 'READY', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartnerPayoutStatus" AS ENUM ('SCHEDULED', 'ADVANCED', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PartnerReferralActivity" AS ENUM ('ACTIVE', 'AT_RISK', 'INACTIVE');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "partner_lifetime_granted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "partner_referral_link" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_referral_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_link_visit" (
    "id" TEXT NOT NULL,
    "link_id" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "visited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_link_visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_referral" (
    "id" TEXT NOT NULL,
    "link_id" TEXT,
    "partner_user_id" TEXT NOT NULL,
    "referred_organization_id" TEXT NOT NULL,
    "signed_up_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'link',
    "attached_by_admin_id" TEXT,
    "attached_reason" TEXT,
    "activity_status" "PartnerReferralActivity" NOT NULL DEFAULT 'ACTIVE',
    "last_qualifying_activity_at" TIMESTAMP(3),
    "last_qualifying_type" TEXT,
    "total_stars_consumed" INTEGER NOT NULL DEFAULT 0,
    "total_purchased_brl" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "activity_recalced_at" TIMESTAMP(3),

    CONSTRAINT "partner_referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "PartnerStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "tier" "PartnerTier",
    "tier_achieved_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "total_earned_brl" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_paid_brl" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_savings_brl" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_referral_revenue_brl" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "manual_tier_override" BOOLEAN NOT NULL DEFAULT false,
    "promoted_by_admin_id" TEXT,
    "grace_period_ends_at" TIMESTAMP(3),
    "grace_period_from_tier" "PartnerTier",
    "grace_period_to_tier" "PartnerTier",
    "last_tier_eval_at" TIMESTAMP(3),
    "accepted_terms_version_id" TEXT,
    "accepted_terms_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_commission" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "payout_id" TEXT,
    "stars_payment_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tier_at_moment" "PartnerTier" NOT NULL,
    "rate_percent" DECIMAL(5,2) NOT NULL,
    "package_id_snapshot" TEXT NOT NULL,
    "package_label_snapshot" TEXT NOT NULL,
    "stars_amount_snapshot" INTEGER NOT NULL,
    "unit_price_brl_snapshot" DECIMAL(10,4) NOT NULL,
    "base_payment_brl" DECIMAL(10,2) NOT NULL,
    "commission_brl" DECIMAL(10,2) NOT NULL,
    "status" "PartnerCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "cycle_year_month" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_star_purchase" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "stars_payment_id" TEXT NOT NULL,
    "tier_at_moment" "PartnerTier" NOT NULL,
    "discount_rate_percent" DECIMAL(5,2) NOT NULL,
    "stars_amount_snapshot" INTEGER NOT NULL,
    "original_price_brl" DECIMAL(10,2) NOT NULL,
    "paid_price_brl" DECIMAL(10,2) NOT NULL,
    "savings_brl" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_star_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_payout" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "cycle_year_month" TEXT NOT NULL,
    "cycle_start" TIMESTAMP(3) NOT NULL,
    "cycle_end" TIMESTAMP(3) NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "gross_brl" DECIMAL(10,2) NOT NULL,
    "advance_fee_brl" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_brl" DECIMAL(10,2) NOT NULL,
    "status" "PartnerPayoutStatus" NOT NULL DEFAULT 'SCHEDULED',
    "paid_at" TIMESTAMP(3),
    "paid_by_admin_id" TEXT,
    "proof_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_tier_history" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "from_tier" "PartnerTier",
    "to_tier" "PartnerTier",
    "reason" TEXT NOT NULL,
    "active_referrals" INTEGER NOT NULL,
    "triggered_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_tier_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_terms_version" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "space_help_track_id" TEXT,
    "content_hash" TEXT NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "published_by_id" TEXT,
    "change_summary" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_terms_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_terms_acceptance" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "terms_version_id" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "content_hash_at_time" TEXT NOT NULL,

    CONSTRAINT "partner_terms_acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_program_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "suite_threshold" INTEGER NOT NULL DEFAULT 10,
    "earth_threshold" INTEGER NOT NULL DEFAULT 25,
    "galaxy_threshold" INTEGER NOT NULL DEFAULT 50,
    "constellation_threshold" INTEGER NOT NULL DEFAULT 100,
    "infinity_threshold" INTEGER NOT NULL DEFAULT 200,
    "suite_commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "earth_commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "galaxy_commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "constellation_commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "infinity_commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "suite_discount_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "earth_discount_rate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "galaxy_discount_rate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "constellation_discount_rate" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "infinity_discount_rate" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "payout_day_of_month" INTEGER NOT NULL DEFAULT 10,
    "advance_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "advance_min_days_before" INTEGER NOT NULL DEFAULT 3,
    "active_org_window_days" INTEGER NOT NULL DEFAULT 90,
    "active_org_min_purchase_brl" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "active_org_min_stars_consumed" INTEGER NOT NULL DEFAULT 1,
    "at_risk_warning_days" INTEGER NOT NULL DEFAULT 14,
    "downgrade_grace_period_days" INTEGER NOT NULL DEFAULT 30,
    "tier_recalc_cadence_days" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_program_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_referral_link_user_id_key" ON "partner_referral_link"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_referral_link_code_key" ON "partner_referral_link"("code");

-- CreateIndex
CREATE INDEX "partner_referral_link_code_idx" ON "partner_referral_link"("code");

-- CreateIndex
CREATE INDEX "partner_link_visit_link_id_visited_at_idx" ON "partner_link_visit"("link_id", "visited_at");

-- CreateIndex
CREATE UNIQUE INDEX "partner_referral_referred_organization_id_key" ON "partner_referral"("referred_organization_id");

-- CreateIndex
CREATE INDEX "partner_referral_partner_user_id_activity_status_idx" ON "partner_referral"("partner_user_id", "activity_status");

-- CreateIndex
CREATE INDEX "partner_referral_source_idx" ON "partner_referral"("source");

-- CreateIndex
CREATE UNIQUE INDEX "partner_user_id_key" ON "partner"("user_id");

-- CreateIndex
CREATE INDEX "partner_status_tier_idx" ON "partner"("status", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "partner_commission_stars_payment_id_key" ON "partner_commission"("stars_payment_id");

-- CreateIndex
CREATE INDEX "partner_commission_partner_id_status_idx" ON "partner_commission"("partner_id", "status");

-- CreateIndex
CREATE INDEX "partner_commission_cycle_year_month_idx" ON "partner_commission"("cycle_year_month");

-- CreateIndex
CREATE UNIQUE INDEX "partner_star_purchase_stars_payment_id_key" ON "partner_star_purchase"("stars_payment_id");

-- CreateIndex
CREATE INDEX "partner_star_purchase_partner_id_created_at_idx" ON "partner_star_purchase"("partner_id", "created_at");

-- CreateIndex
CREATE INDEX "partner_payout_status_scheduled_for_idx" ON "partner_payout"("status", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "partner_payout_partner_id_cycle_year_month_key" ON "partner_payout"("partner_id", "cycle_year_month");

-- CreateIndex
CREATE INDEX "partner_tier_history_partner_id_created_at_idx" ON "partner_tier_history"("partner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "partner_terms_version_version_key" ON "partner_terms_version"("version");

-- CreateIndex
CREATE INDEX "partner_terms_version_is_active_effective_at_idx" ON "partner_terms_version"("is_active", "effective_at");

-- CreateIndex
CREATE INDEX "partner_terms_acceptance_partner_id_idx" ON "partner_terms_acceptance"("partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_terms_acceptance_partner_id_terms_version_id_key" ON "partner_terms_acceptance"("partner_id", "terms_version_id");

-- AddForeignKey
ALTER TABLE "partner_referral_link" ADD CONSTRAINT "partner_referral_link_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_link_visit" ADD CONSTRAINT "partner_link_visit_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "partner_referral_link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_referral" ADD CONSTRAINT "partner_referral_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "partner_referral_link"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_referral" ADD CONSTRAINT "partner_referral_partner_user_id_fkey" FOREIGN KEY ("partner_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_referral" ADD CONSTRAINT "partner_referral_referred_organization_id_fkey" FOREIGN KEY ("referred_organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_referral" ADD CONSTRAINT "partner_referral_attached_by_admin_id_fkey" FOREIGN KEY ("attached_by_admin_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner" ADD CONSTRAINT "partner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commission" ADD CONSTRAINT "partner_commission_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commission" ADD CONSTRAINT "partner_commission_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "partner_payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commission" ADD CONSTRAINT "partner_commission_stars_payment_id_fkey" FOREIGN KEY ("stars_payment_id") REFERENCES "stars_payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commission" ADD CONSTRAINT "partner_commission_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_star_purchase" ADD CONSTRAINT "partner_star_purchase_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_star_purchase" ADD CONSTRAINT "partner_star_purchase_stars_payment_id_fkey" FOREIGN KEY ("stars_payment_id") REFERENCES "stars_payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_payout" ADD CONSTRAINT "partner_payout_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_payout" ADD CONSTRAINT "partner_payout_paid_by_admin_id_fkey" FOREIGN KEY ("paid_by_admin_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_tier_history" ADD CONSTRAINT "partner_tier_history_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_tier_history" ADD CONSTRAINT "partner_tier_history_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_terms_version" ADD CONSTRAINT "partner_terms_version_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_terms_acceptance" ADD CONSTRAINT "partner_terms_acceptance_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_terms_acceptance" ADD CONSTRAINT "partner_terms_acceptance_terms_version_id_fkey" FOREIGN KEY ("terms_version_id") REFERENCES "partner_terms_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
