-- CreateEnum
CREATE TYPE "TrafegoPlatform" AS ENUM ('META_ADS', 'WHATSAPP_OFICIAL');

-- CreateEnum
CREATE TYPE "TrafegoCampaignType" AS ENUM ('PROSPECCAO', 'REMARKETING', 'VENDA_DIRETA', 'RECONHECIMENTO', 'RELACIONAMENTO');

-- CreateEnum
CREATE TYPE "TrafegoObjective" AS ENUM ('LEADS', 'TRAFFIC', 'SALES', 'AWARENESS', 'ENGAGEMENT', 'MESSAGES', 'BROADCAST');

-- CreateEnum
CREATE TYPE "TrafegoOrderStatus" AS ENUM ('PAID', 'ONBOARDING', 'MATERIALS_SUBMITTED', 'REQUESTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TrafegoPendingPurchaseStatus" AS ENUM ('PENDING', 'PAID', 'REDEEMED', 'EXPIRED', 'REFUNDED', 'CANCELLED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "TrafegoCreativeKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "TrafegoCreativeStatus" AS ENUM ('UPLOADED', 'SELECTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TrafegoCopySource" AS ENUM ('CLIENT', 'SUGGESTED_BY_NASA', 'AI');

-- CreateEnum
CREATE TYPE "TrafegoSupportAuthorRole" AS ENUM ('CLIENT', 'NASA');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "app_scope" TEXT;

-- CreateTable
CREATE TABLE "trafego_plan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headline" TEXT,
    "description" TEXT,
    "platform" "TrafegoPlatform" NOT NULL,
    "campaign_types" "TrafegoCampaignType"[],
    "objectives" "TrafegoObjective"[],
    "ad_budget_brl_cents" INTEGER NOT NULL,
    "service_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "service_fee_brl_cents" INTEGER,
    "duration_days" INTEGER NOT NULL DEFAULT 30,
    "max_creatives" INTEGER NOT NULL DEFAULT 3,
    "max_copies" INTEGER NOT NULL DEFAULT 3,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

CONSTRAINT "trafego_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trafego_pending_purchase" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company_name" TEXT,
    "user_id" TEXT,
    "flow" TEXT NOT NULL DEFAULT 'public',
    "plan_id" TEXT NOT NULL,
    "campaign_type" "TrafegoCampaignType" NOT NULL,
    "platform" "TrafegoPlatform" NOT NULL,
    "objective" "TrafegoObjective" NOT NULL,
    "briefing" JSONB NOT NULL DEFAULT '{}',
    "ad_budget_brl_cents" INTEGER NOT NULL,
    "service_fee_brl_cents" INTEGER NOT NULL,
    "amount_brl_cents" INTEGER NOT NULL,
    "stripe_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "signup_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "status" "TrafegoPendingPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "amount_mismatch" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "redeemed_at" TIMESTAMP(3),
    "redeemed_by_user_id" TEXT,
    "last_reminder_sent_at" TIMESTAMP(3),
    "last_reminder_stage" TEXT,

CONSTRAINT "trafego_pending_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trafego_order" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "pending_purchase_id" TEXT,
    "plan_name_snapshot" TEXT NOT NULL,
    "campaign_type" "TrafegoCampaignType" NOT NULL,
    "platform" "TrafegoPlatform" NOT NULL,
    "objective" "TrafegoObjective" NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "max_creatives" INTEGER NOT NULL,
    "max_copies" INTEGER NOT NULL,
    "ad_budget_brl_cents" INTEGER NOT NULL,
    "service_fee_brl_cents" INTEGER NOT NULL,
    "total_brl_cents" INTEGER NOT NULL,
    "stripe_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "business_name" TEXT,
    "business_niche" TEXT,
    "target_audience" TEXT,
    "destination_url" TEXT,
    "whatsapp_number" TEXT,
    "notes" TEXT,
    "status" "TrafegoOrderStatus" NOT NULL DEFAULT 'PAID',
    "requested_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "meta_ad_campaign_id" TEXT,
    "meta_campaign_external_id" TEXT,
    "metrics_organization_id" TEXT,
    "broadcast_id" TEXT,
    "assigned_to_user_id" TEXT,
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

CONSTRAINT "trafego_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trafego_order_event" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" "TrafegoOrderStatus",
    "to_status" "TrafegoOrderStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "is_client_visible" BOOLEAN NOT NULL DEFAULT true,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "trafego_order_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trafego_creative" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "kind" "TrafegoCreativeKind" NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "TrafegoCreativeStatus" NOT NULL DEFAULT 'UPLOADED',
    "meta_image_hash" TEXT,
    "meta_video_id" TEXT,
    "review_note" TEXT,
    "uploaded_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "trafego_creative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trafego_copy" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "headline" TEXT,
    "primary_text" TEXT NOT NULL,
    "description" TEXT,
    "call_to_action" TEXT,
    "source" "TrafegoCopySource" NOT NULL DEFAULT 'CLIENT',
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

CONSTRAINT "trafego_copy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trafego_support_message" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "author_role" "TrafegoSupportAuthorRole" NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_key" TEXT,
    "read_by_client_at" TIMESTAMP(3),
    "read_by_nasa_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "trafego_support_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trafego_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "agency_organization_id" TEXT,
    "default_broadcast_tracking_id" TEXT,
    "sales_tracking_id" TEXT,
    "sales_status_id" TEXT,
    "default_service_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "support_whatsapp" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

CONSTRAINT "trafego_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trafego_plan_slug_key" ON "trafego_plan"("slug");

-- CreateIndex
CREATE INDEX "trafego_plan_is_active_platform_position_idx" ON "trafego_plan"("is_active", "platform", "position");

-- CreateIndex
CREATE UNIQUE INDEX "trafego_pending_purchase_signup_token_key" ON "trafego_pending_purchase"("signup_token");

-- CreateIndex
CREATE INDEX "trafego_pending_purchase_email_idx" ON "trafego_pending_purchase"("email");

-- CreateIndex
CREATE INDEX "trafego_pending_purchase_status_idx" ON "trafego_pending_purchase"("status");

-- CreateIndex
CREATE INDEX "trafego_pending_purchase_stripe_session_id_idx" ON "trafego_pending_purchase"("stripe_session_id");

-- CreateIndex
CREATE INDEX "trafego_pending_purchase_user_id_idx" ON "trafego_pending_purchase"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trafego_order_code_key" ON "trafego_order"("code");

-- CreateIndex
CREATE UNIQUE INDEX "trafego_order_pending_purchase_id_key" ON "trafego_order"("pending_purchase_id");

-- CreateIndex
CREATE UNIQUE INDEX "trafego_order_broadcast_id_key" ON "trafego_order"("broadcast_id");

-- CreateIndex
CREATE INDEX "trafego_order_organization_id_status_idx" ON "trafego_order"("organization_id", "status");

-- CreateIndex
CREATE INDEX "trafego_order_status_requested_at_idx" ON "trafego_order"("status", "requested_at");

-- CreateIndex
CREATE INDEX "trafego_order_meta_campaign_external_id_idx" ON "trafego_order"("meta_campaign_external_id");

-- CreateIndex
CREATE INDEX "trafego_order_event_order_id_created_at_idx" ON "trafego_order_event"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "trafego_creative_order_id_position_idx" ON "trafego_creative"("order_id", "position");

-- CreateIndex
CREATE INDEX "trafego_copy_order_id_position_idx" ON "trafego_copy"("order_id", "position");

-- CreateIndex
CREATE INDEX "trafego_support_message_order_id_created_at_idx" ON "trafego_support_message"("order_id", "created_at");

-- AddForeignKey
ALTER TABLE "trafego_pending_purchase" ADD CONSTRAINT "trafego_pending_purchase_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "trafego_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_pending_purchase" ADD CONSTRAINT "trafego_pending_purchase_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_pending_purchase" ADD CONSTRAINT "trafego_pending_purchase_redeemed_by_user_id_fkey" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_order" ADD CONSTRAINT "trafego_order_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_order" ADD CONSTRAINT "trafego_order_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_order" ADD CONSTRAINT "trafego_order_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_order" ADD CONSTRAINT "trafego_order_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "trafego_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_order" ADD CONSTRAINT "trafego_order_pending_purchase_id_fkey" FOREIGN KEY ("pending_purchase_id") REFERENCES "trafego_pending_purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_order" ADD CONSTRAINT "trafego_order_meta_ad_campaign_id_fkey" FOREIGN KEY ("meta_ad_campaign_id") REFERENCES "meta_ad_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_order" ADD CONSTRAINT "trafego_order_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_order_event" ADD CONSTRAINT "trafego_order_event_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "trafego_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_order_event" ADD CONSTRAINT "trafego_order_event_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_creative" ADD CONSTRAINT "trafego_creative_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "trafego_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_creative" ADD CONSTRAINT "trafego_creative_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_copy" ADD CONSTRAINT "trafego_copy_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "trafego_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_support_message" ADD CONSTRAINT "trafego_support_message_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "trafego_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trafego_support_message" ADD CONSTRAINT "trafego_support_message_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
