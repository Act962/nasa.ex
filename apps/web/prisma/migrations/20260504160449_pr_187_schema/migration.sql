-- CreateEnum
CREATE TYPE "MetaAccountKind" AS ENUM ('AD_ACCOUNT', 'PAGE', 'IG_ACCOUNT');

-- CreateEnum
CREATE TYPE "PendingCoursePurchaseStatus" AS ENUM ('PENDING', 'PAID', 'REDEEMED', 'EXPIRED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MetaAdEntityStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'PENDING_REVIEW', 'DISAPPROVED', 'PREAPPROVED', 'PENDING_BILLING_INFO', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'IN_PROCESS', 'WITH_ISSUES');

-- CreateEnum
CREATE TYPE "MetaAdLevel" AS ENUM ('ACCOUNT', 'CAMPAIGN', 'ADSET', 'AD');

-- AlterEnum
ALTER TYPE "StarTransactionType" ADD VALUE 'WELCOME_BONUS';

-- AlterTable
ALTER TABLE "nasa_planner_post_slides" ADD COLUMN     "target_format" TEXT DEFAULT '1:1',
ADD COLUMN     "video_key" TEXT;

-- AlterTable
ALTER TABLE "nasa_planner_posts" ADD COLUMN     "external_fb_post_id" TEXT,
ADD COLUMN     "external_ig_post_id" TEXT,
ADD COLUMN     "is_ad" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "logo_key" TEXT,
ADD COLUMN     "metrics_comments" INTEGER,
ADD COLUMN     "metrics_impressions" INTEGER,
ADD COLUMN     "metrics_likes" INTEGER,
ADD COLUMN     "metrics_reach" INTEGER,
ADD COLUMN     "metrics_shares" INTEGER,
ADD COLUMN     "metrics_sync_error" TEXT,
ADD COLUMN     "metrics_synced_at" TIMESTAMP(3),
ADD COLUMN     "metrics_video_views" INTEGER,
ADD COLUMN     "publish_error" TEXT,
ADD COLUMN     "target_fb_page_id" TEXT,
ADD COLUMN     "target_ig_account_id" TEXT,
ADD COLUMN     "video_duration" INTEGER,
ADD COLUMN     "video_key" TEXT;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "stars_bonus_balance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "platform_integrations" ADD COLUMN     "last_error_at" TIMESTAMP(3),
ADD COLUMN     "last_error_message" TEXT,
ADD COLUMN     "last_sync_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "member_meta_account_access" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "MetaAccountKind" NOT NULL,
    "account_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_meta_account_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_course_purchase" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "price_stars" INTEGER NOT NULL,
    "amount_brl_cents" INTEGER NOT NULL,
    "star_price_brl_snapshot" DECIMAL(10,4) NOT NULL,
    "stripe_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "signup_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "status" "PendingCoursePurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "redeemed_at" TIMESTAMP(3),
    "redeemed_by_user_id" TEXT,
    "redeemed_enrollment_id" TEXT,

    CONSTRAINT "pending_course_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "router_payment_settings" (
    "id" TEXT NOT NULL,
    "star_price_brl" DECIMAL(10,4) NOT NULL DEFAULT 0.15,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "router_payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ads_kpi_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "level" "MetaAdLevel" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_name" TEXT,
    "date" DATE NOT NULL,
    "date_preset" TEXT,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "frequency" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cpm" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "cpc" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "cpp" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "cpl" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "cpa" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "cpv" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "conversion_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "conversion_rate" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "roas" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "roi" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "video_plays" INTEGER NOT NULL DEFAULT 0,
    "video_p25" INTEGER NOT NULL DEFAULT 0,
    "video_p50" INTEGER NOT NULL DEFAULT 0,
    "video_p75" INTEGER NOT NULL DEFAULT 0,
    "video_p100" INTEGER NOT NULL DEFAULT 0,
    "video_avg_watch_time" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "raw" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_ads_kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ad_campaigns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "meta_campaign_id" TEXT,
    "ad_account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "status" "MetaAdEntityStatus" NOT NULL DEFAULT 'PAUSED',
    "effective_status" TEXT,
    "special_ad_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "buying_type" TEXT,
    "daily_budget" DECIMAL(14,2),
    "lifetime_budget" DECIMAL(14,2),
    "bid_strategy" TEXT,
    "start_time" TIMESTAMP(3),
    "stop_time" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_adsets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "meta_adset_id" TEXT,
    "name" TEXT NOT NULL,
    "status" "MetaAdEntityStatus" NOT NULL DEFAULT 'PAUSED',
    "effective_status" TEXT,
    "optimization_goal" TEXT,
    "billing_event" TEXT,
    "bid_amount" DECIMAL(14,4),
    "daily_budget" DECIMAL(14,2),
    "lifetime_budget" DECIMAL(14,2),
    "targeting" JSONB,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_adsets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "adset_id" TEXT NOT NULL,
    "meta_ad_id" TEXT,
    "name" TEXT NOT NULL,
    "status" "MetaAdEntityStatus" NOT NULL DEFAULT 'PAUSED',
    "effective_status" TEXT,
    "creative_id" TEXT,
    "creative" JSONB,
    "preview_url" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_meta_account_access_organization_id_user_id_idx" ON "member_meta_account_access"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_meta_account_access_organization_id_user_id_kind_acc_key" ON "member_meta_account_access"("organization_id", "user_id", "kind", "account_key");

-- CreateIndex
CREATE UNIQUE INDEX "pending_course_purchase_signup_token_key" ON "pending_course_purchase"("signup_token");

-- CreateIndex
CREATE INDEX "pending_course_purchase_email_idx" ON "pending_course_purchase"("email");

-- CreateIndex
CREATE INDEX "pending_course_purchase_status_idx" ON "pending_course_purchase"("status");

-- CreateIndex
CREATE INDEX "pending_course_purchase_stripe_session_id_idx" ON "pending_course_purchase"("stripe_session_id");

-- CreateIndex
CREATE INDEX "meta_ads_kpi_snapshots_organization_id_level_date_idx" ON "meta_ads_kpi_snapshots"("organization_id", "level", "date");

-- CreateIndex
CREATE INDEX "meta_ads_kpi_snapshots_organization_id_entity_id_idx" ON "meta_ads_kpi_snapshots"("organization_id", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ads_kpi_snapshots_organization_id_level_entity_id_date_key" ON "meta_ads_kpi_snapshots"("organization_id", "level", "entity_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ad_campaigns_meta_campaign_id_key" ON "meta_ad_campaigns"("meta_campaign_id");

-- CreateIndex
CREATE INDEX "meta_ad_campaigns_organization_id_idx" ON "meta_ad_campaigns"("organization_id");

-- CreateIndex
CREATE INDEX "meta_ad_campaigns_ad_account_id_idx" ON "meta_ad_campaigns"("ad_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_adsets_meta_adset_id_key" ON "meta_adsets"("meta_adset_id");

-- CreateIndex
CREATE INDEX "meta_adsets_organization_id_idx" ON "meta_adsets"("organization_id");

-- CreateIndex
CREATE INDEX "meta_adsets_campaign_id_idx" ON "meta_adsets"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ads_meta_ad_id_key" ON "meta_ads"("meta_ad_id");

-- CreateIndex
CREATE INDEX "meta_ads_organization_id_idx" ON "meta_ads"("organization_id");

-- CreateIndex
CREATE INDEX "meta_ads_campaign_id_idx" ON "meta_ads"("campaign_id");

-- CreateIndex
CREATE INDEX "meta_ads_adset_id_idx" ON "meta_ads"("adset_id");

-- AddForeignKey
ALTER TABLE "member_meta_account_access" ADD CONSTRAINT "member_meta_account_access_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_meta_account_access" ADD CONSTRAINT "member_meta_account_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_course_purchase" ADD CONSTRAINT "pending_course_purchase_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "nasa_route_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_course_purchase" ADD CONSTRAINT "pending_course_purchase_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "nasa_route_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_course_purchase" ADD CONSTRAINT "pending_course_purchase_redeemed_by_user_id_fkey" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "router_payment_settings" ADD CONSTRAINT "router_payment_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads_kpi_snapshots" ADD CONSTRAINT "meta_ads_kpi_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ad_campaigns" ADD CONSTRAINT "meta_ad_campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_adsets" ADD CONSTRAINT "meta_adsets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_adsets" ADD CONSTRAINT "meta_adsets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "meta_ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads" ADD CONSTRAINT "meta_ads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads" ADD CONSTRAINT "meta_ads_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "meta_ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads" ADD CONSTRAINT "meta_ads_adset_id_fkey" FOREIGN KEY ("adset_id") REFERENCES "meta_adsets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
