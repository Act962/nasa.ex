-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "group_participants_count" INTEGER,
ADD COLUMN     "group_subject" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "via_in_chat" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "nasa_planner_posts" ADD COLUMN     "action_id" TEXT,
ADD COLUMN     "template_id" TEXT,
ADD COLUMN     "video_edit_timeline_json" JSONB,
ADD COLUMN     "video_transcription_data" JSONB;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "brand_extracted_at" TIMESTAMP(3),
ADD COLUMN     "brand_font_body" TEXT,
ADD COLUMN     "brand_font_heading" TEXT,
ADD COLUMN     "brand_logo_url" TEXT,
ADD COLUMN     "brand_logo_variants" JSONB,
ADD COLUMN     "brand_palette_hex" JSONB,
ADD COLUMN     "stars_grace_started_at" TIMESTAMP(3),
ADD COLUMN     "stars_last_alert_at" TIMESTAMP(3),
ADD COLUMN     "stars_suspended_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_instances" ADD COLUMN     "in_chat_activated_at" TIMESTAMP(3),
ADD COLUMN     "in_chat_failure_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "in_chat_mode_active" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "user_stickers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL DEFAULT 'image/webp',
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_stickers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_planner_post_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ratio" TEXT NOT NULL,
    "layoutJson" JSONB NOT NULL,
    "preview_key" TEXT,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_planner_post_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_stickers_organization_id_created_at_idx" ON "user_stickers"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_stickers_user_id_idx" ON "user_stickers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_planner_post_templates_slug_key" ON "nasa_planner_post_templates"("slug");

-- CreateIndex
CREATE INDEX "nasa_planner_post_templates_organization_id_is_global_idx" ON "nasa_planner_post_templates"("organization_id", "is_global");

-- CreateIndex
CREATE INDEX "nasa_planner_post_templates_category_idx" ON "nasa_planner_post_templates"("category");

-- CreateIndex
CREATE INDEX "nasa_planner_posts_action_id_idx" ON "nasa_planner_posts"("action_id");

-- CreateIndex
CREATE INDEX "nasa_planner_posts_template_id_idx" ON "nasa_planner_posts"("template_id");

-- CreateIndex
CREATE INDEX "whatsapp_instances_in_chat_mode_active_idx" ON "whatsapp_instances"("in_chat_mode_active");

-- AddForeignKey
ALTER TABLE "user_stickers" ADD CONSTRAINT "user_stickers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stickers" ADD CONSTRAINT "user_stickers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_posts" ADD CONSTRAINT "nasa_planner_posts_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_posts" ADD CONSTRAINT "nasa_planner_posts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "nasa_planner_post_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_post_templates" ADD CONSTRAINT "nasa_planner_post_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
