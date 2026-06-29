/*
  Warnings:

  - You are about to drop the `nasa_post_brand_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nasa_post_slides` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nasa_posts` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "NasaPlannerPostStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "NasaPlannerPostType" AS ENUM ('STATIC', 'CAROUSEL', 'REEL', 'STORY');

-- CreateEnum
CREATE TYPE "NasaPlannerCardStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "nasa_post_brand_configs" DROP CONSTRAINT "nasa_post_brand_configs_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "nasa_post_slides" DROP CONSTRAINT "nasa_post_slides_post_id_fkey";

-- DropForeignKey
ALTER TABLE "nasa_posts" DROP CONSTRAINT "nasa_posts_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "nasa_posts" DROP CONSTRAINT "nasa_posts_organization_id_fkey";

-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "attachments" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "cover_image" TEXT,
ADD COLUMN     "history" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_favorited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "links" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "youtube_url" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "nickname" TEXT;

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "background_color" TEXT,
ADD COLUMN     "background_image" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'PRIVATE';

-- DropTable
DROP TABLE "nasa_post_brand_configs";

-- DropTable
DROP TABLE "nasa_post_slides";

-- DropTable
DROP TABLE "nasa_posts";

-- DropEnum
DROP TYPE "NasaPostStatus";

-- DropEnum
DROP TYPE "NasaPostType";

-- CreateTable
CREATE TABLE "nasa_planner" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand_name" TEXT,
    "brand_slogan" TEXT,
    "website" TEXT,
    "icp" TEXT,
    "swot" JSONB NOT NULL DEFAULT '{}',
    "positioning" TEXT,
    "tone_of_voice" TEXT,
    "key_messages" TEXT[],
    "forbidden_words" TEXT[],
    "primary_colors" TEXT[],
    "secondary_colors" TEXT[],
    "fonts" JSONB NOT NULL DEFAULT '{}',
    "logo_light" TEXT,
    "logo_dark" TEXT,
    "logo_square" TEXT,
    "logo_horizontal" TEXT,
    "default_hashtags" TEXT[],
    "default_ctas" TEXT[],
    "example_posts" TEXT[],
    "show_branding" BOOLEAN NOT NULL DEFAULT true,
    "anthropic_api_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_planner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_planner_posts" (
    "id" TEXT NOT NULL,
    "planner_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "type" "NasaPlannerPostType" NOT NULL DEFAULT 'STATIC',
    "status" "NasaPlannerPostStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "caption" TEXT,
    "hashtags" TEXT[],
    "cta" TEXT,
    "ai_prompt" TEXT,
    "stars_spent" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "target_networks" TEXT[],
    "thumbnail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_planner_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_planner_post_slides" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "image_key" TEXT,
    "headline" TEXT,
    "subtext" TEXT,
    "overlay_config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_planner_post_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_planner_mind_maps" (
    "id" TEXT NOT NULL,
    "planner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" TEXT,
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "edges" JSONB NOT NULL DEFAULT '[]',
    "viewport" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_planner_mind_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_planner_cards" (
    "id" TEXT NOT NULL,
    "mind_map_id" TEXT NOT NULL,
    "planner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "NasaPlannerCardStatus" NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assignee_ids" TEXT[],
    "due_date" TIMESTAMP(3),
    "linked_app" TEXT,
    "linked_id" TEXT,
    "node_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_planner_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_planner_calendar_shares" (
    "id" TEXT NOT NULL,
    "planner_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_planner_calendar_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_permission" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "app_key" TEXT NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_create" BOOLEAN NOT NULL DEFAULT true,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_activity_log" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resource_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_activity_log" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "user_image" TEXT,
    "app_slug" TEXT NOT NULL DEFAULT 'system',
    "action" TEXT NOT NULL,
    "action_label" TEXT NOT NULL,
    "resource" TEXT,
    "resource_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_presence" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "user_image" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_presence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#7C3AED',
    "workspace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_tags" (
    "action_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "action_tags_pkey" PRIMARY KEY ("action_id","tag_id")
);

-- CreateTable
CREATE TABLE "workspace_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_folder_items" (
    "folder_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "workspace_folder_items_pkey" PRIMARY KEY ("folder_id","workspace_id")
);

-- CreateTable
CREATE TABLE "workspace_automations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "trigger" TEXT NOT NULL,
    "trigger_data" JSONB NOT NULL DEFAULT '{}',
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_mirrors" (
    "id" TEXT NOT NULL,
    "source_action_id" TEXT NOT NULL,
    "mirror_action_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_mirrors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nasa_planner_organization_id_idx" ON "nasa_planner"("organization_id");

-- CreateIndex
CREATE INDEX "nasa_planner_posts_planner_id_status_idx" ON "nasa_planner_posts"("planner_id", "status");

-- CreateIndex
CREATE INDEX "nasa_planner_posts_planner_id_scheduled_at_idx" ON "nasa_planner_posts"("planner_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "nasa_planner_posts_organization_id_idx" ON "nasa_planner_posts"("organization_id");

-- CreateIndex
CREATE INDEX "nasa_planner_post_slides_post_id_order_idx" ON "nasa_planner_post_slides"("post_id", "order");

-- CreateIndex
CREATE INDEX "nasa_planner_mind_maps_planner_id_idx" ON "nasa_planner_mind_maps"("planner_id");

-- CreateIndex
CREATE INDEX "nasa_planner_cards_mind_map_id_idx" ON "nasa_planner_cards"("mind_map_id");

-- CreateIndex
CREATE INDEX "nasa_planner_cards_planner_id_idx" ON "nasa_planner_cards"("planner_id");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_planner_calendar_shares_token_key" ON "nasa_planner_calendar_shares"("token");

-- CreateIndex
CREATE INDEX "nasa_planner_calendar_shares_planner_id_idx" ON "nasa_planner_calendar_shares"("planner_id");

-- CreateIndex
CREATE INDEX "org_permission_organization_id_idx" ON "org_permission"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_permission_organization_id_role_app_key_key" ON "org_permission"("organization_id", "role", "app_key");

-- CreateIndex
CREATE INDEX "org_activity_log_organization_id_created_at_idx" ON "org_activity_log"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "org_activity_log_user_id_idx" ON "org_activity_log"("user_id");

-- CreateIndex
CREATE INDEX "system_activity_log_organization_id_created_at_idx" ON "system_activity_log"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "system_activity_log_user_id_idx" ON "system_activity_log"("user_id");

-- CreateIndex
CREATE INDEX "system_activity_log_app_slug_idx" ON "system_activity_log"("app_slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_presence_user_id_organization_id_key" ON "user_presence"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "workspace_tags_workspace_id_idx" ON "workspace_tags"("workspace_id");

-- CreateIndex
CREATE INDEX "action_tags_tag_id_idx" ON "action_tags"("tag_id");

-- CreateIndex
CREATE INDEX "workspace_folders_organization_id_idx" ON "workspace_folders"("organization_id");

-- CreateIndex
CREATE INDEX "workspace_automations_workspace_id_idx" ON "workspace_automations"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "action_mirrors_mirror_action_id_key" ON "action_mirrors"("mirror_action_id");

-- CreateIndex
CREATE UNIQUE INDEX "action_mirrors_source_action_id_mirror_action_id_key" ON "action_mirrors"("source_action_id", "mirror_action_id");

-- AddForeignKey
ALTER TABLE "nasa_planner" ADD CONSTRAINT "nasa_planner_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_posts" ADD CONSTRAINT "nasa_planner_posts_planner_id_fkey" FOREIGN KEY ("planner_id") REFERENCES "nasa_planner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_posts" ADD CONSTRAINT "nasa_planner_posts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_post_slides" ADD CONSTRAINT "nasa_planner_post_slides_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "nasa_planner_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_mind_maps" ADD CONSTRAINT "nasa_planner_mind_maps_planner_id_fkey" FOREIGN KEY ("planner_id") REFERENCES "nasa_planner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_cards" ADD CONSTRAINT "nasa_planner_cards_mind_map_id_fkey" FOREIGN KEY ("mind_map_id") REFERENCES "nasa_planner_mind_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_calendar_shares" ADD CONSTRAINT "nasa_planner_calendar_shares_planner_id_fkey" FOREIGN KEY ("planner_id") REFERENCES "nasa_planner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_permission" ADD CONSTRAINT "org_permission_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_activity_log" ADD CONSTRAINT "org_activity_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_activity_log" ADD CONSTRAINT "system_activity_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_tags" ADD CONSTRAINT "workspace_tags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_tags" ADD CONSTRAINT "action_tags_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_tags" ADD CONSTRAINT "action_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "workspace_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_folders" ADD CONSTRAINT "workspace_folders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_folder_items" ADD CONSTRAINT "workspace_folder_items_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "workspace_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_folder_items" ADD CONSTRAINT "workspace_folder_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_automations" ADD CONSTRAINT "workspace_automations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_mirrors" ADD CONSTRAINT "action_mirrors_source_action_id_fkey" FOREIGN KEY ("source_action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_mirrors" ADD CONSTRAINT "action_mirrors_mirror_action_id_fkey" FOREIGN KEY ("mirror_action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
