-- Planner v2 (specs 0057 e 0058): contas de publicação, aprovação, pilares, horários, tentativas e metas.
-- CreateEnum
CREATE TYPE "NasaPlannerPostSource" AS ENUM ('WEB', 'ASTRO', 'WHATSAPP', 'MCP');

-- CreateEnum
CREATE TYPE "NasaPlannerReviewKind" AS ENUM ('SUBMITTED', 'COMMENT', 'CHANGES_REQUESTED', 'APPROVED', 'REOPENED');

-- CreateEnum
CREATE TYPE "NasaPlannerPublishNetwork" AS ENUM ('INSTAGRAM', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "NasaPlannerSlotSource" AS ENUM ('DEFAULT', 'MANUAL', 'INSIGHTS');

-- CreateEnum
CREATE TYPE "MetaPublishAccountKind" AS ENUM ('IG_BUSINESS', 'FB_PAGE');

-- CreateEnum
CREATE TYPE "MetaPublishAccountStatus" AS ENUM ('ACTIVE', 'NEEDS_RECONNECT', 'DISABLED');


-- AlterTable
ALTER TABLE "nasa_planner" ADD COLUMN     "requires_approval" BOOLEAN;

-- AlterTable
ALTER TABLE "nasa_planner_posts" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "changes_requested_at" TIMESTAMP(3),
ADD COLUMN     "external_ig_permalink" TEXT,
ADD COLUMN     "moment_key" TEXT,
ADD COLUMN     "pillar_id" TEXT,
ADD COLUMN     "publish_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "publish_error_code" TEXT,
ADD COLUMN     "publishing_started_at" TIMESTAMP(3),
ADD COLUMN     "reviewer_id" TEXT,
ADD COLUMN     "schedule_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "script" TEXT,
ADD COLUMN     "source" "NasaPlannerPostSource" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "source_actor_label" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ADD COLUMN     "submitted_by_id" TEXT;

-- CreateTable
CREATE TABLE "meta_publish_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "MetaPublishAccountKind" NOT NULL,
    "page_id" TEXT NOT NULL,
    "page_name" TEXT,
    "ig_user_id" TEXT,
    "ig_username" TEXT,
    "profile_picture_url" TEXT,
    "access_token_enc" TEXT NOT NULL,
    "status" "MetaPublishAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "last_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_publish_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_planner_post_reviews" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "author_id" TEXT,
    "kind" "NasaPlannerReviewKind" NOT NULL,
    "body" TEXT,
    "checklist" JSONB,
    "slide_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_planner_post_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_planner_content_pillars" (
    "id" TEXT NOT NULL,
    "planner_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color_token" TEXT NOT NULL DEFAULT 'info',
    "description" TEXT,
    "target_share_pct" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_planner_content_pillars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_planner_publish_slots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "publish_account_id" TEXT,
    "weekday" INTEGER NOT NULL,
    "minute_of_day" INTEGER NOT NULL,
    "source" "NasaPlannerSlotSource" NOT NULL DEFAULT 'MANUAL',
    "score" DOUBLE PRECISION,
    "post_types" "NasaPlannerPostType"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_planner_publish_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_planner_publish_attempts" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "network" "NasaPlannerPublishNetwork" NOT NULL,
    "schedule_version" INTEGER NOT NULL,
    "step" TEXT NOT NULL,
    "container_id" TEXT,
    "external_id" TEXT,
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT,
    "trigger" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_planner_publish_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_planner_cadence_goals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "post_type" "NasaPlannerPostType" NOT NULL,
    "per_week" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_planner_cadence_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_publish_accounts_ig_user_id_idx" ON "meta_publish_accounts"("ig_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_publish_accounts_organization_id_kind_page_id_key" ON "meta_publish_accounts"("organization_id", "kind", "page_id");

-- CreateIndex
CREATE INDEX "nasa_planner_post_reviews_post_id_created_at_idx" ON "nasa_planner_post_reviews"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "nasa_planner_post_reviews_organization_id_idx" ON "nasa_planner_post_reviews"("organization_id");

-- CreateIndex
CREATE INDEX "nasa_planner_content_pillars_planner_id_idx" ON "nasa_planner_content_pillars"("planner_id");

-- CreateIndex
CREATE INDEX "nasa_planner_content_pillars_organization_id_idx" ON "nasa_planner_content_pillars"("organization_id");

-- CreateIndex
CREATE INDEX "nasa_planner_publish_slots_organization_id_is_active_idx" ON "nasa_planner_publish_slots"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "nasa_planner_publish_attempts_post_id_created_at_idx" ON "nasa_planner_publish_attempts"("post_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_planner_cadence_goals_organization_id_post_type_key" ON "nasa_planner_cadence_goals"("organization_id", "post_type");

-- CreateIndex
CREATE INDEX "nasa_planner_posts_organization_id_scheduled_at_idx" ON "nasa_planner_posts"("organization_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "nasa_planner_posts_status_scheduled_at_idx" ON "nasa_planner_posts"("status", "scheduled_at");

-- AddForeignKey
ALTER TABLE "nasa_planner_posts" ADD CONSTRAINT "nasa_planner_posts_pillar_id_fkey" FOREIGN KEY ("pillar_id") REFERENCES "nasa_planner_content_pillars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_publish_accounts" ADD CONSTRAINT "meta_publish_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_post_reviews" ADD CONSTRAINT "nasa_planner_post_reviews_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "nasa_planner_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_content_pillars" ADD CONSTRAINT "nasa_planner_content_pillars_planner_id_fkey" FOREIGN KEY ("planner_id") REFERENCES "nasa_planner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_publish_attempts" ADD CONSTRAINT "nasa_planner_publish_attempts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "nasa_planner_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
