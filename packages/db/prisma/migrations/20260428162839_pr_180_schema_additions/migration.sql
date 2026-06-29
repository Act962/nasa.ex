-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('EXECUTIVE', 'TECH', 'DESIGN', 'PRODUCT', 'MARKETING', 'SALES', 'OPERATIONS', 'FINANCE', 'HR', 'LEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('APPROVED', 'PENDING', 'HIDDEN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StarTransactionType" ADD VALUE 'COURSE_PURCHASE';
ALTER TYPE "StarTransactionType" ADD VALUE 'COURSE_PAYOUT';

-- AlterEnum
ALTER TYPE "NasaPageIntent" ADD VALUE 'SPACE_PAGE';

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "banner_url" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "company_segment" TEXT,
ADD COLUMN     "company_type" TEXT,
ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "is_spacehome_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nasa_page_id" TEXT,
ADD COLUMN     "spacehome_template" TEXT DEFAULT 'default',
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "forms" ADD COLUMN     "is_public_on_space" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "forge_contracts" ADD COLUMN     "client_data" JSONB;

-- AlterTable
ALTER TABLE "nbox_items" ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "public_token" TEXT;

-- AlterTable
ALTER TABLE "org_projects" ADD COLUMN     "is_public_on_space" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "job_title_catalog" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "JobCategory" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_title_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_roles" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT,
    "job_title_id" TEXT NOT NULL,
    "custom_label" TEXT,
    "parent_id" TEXT,
    "department" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "public_consent" BOOLEAN NOT NULL DEFAULT false,
    "consented_at" TIMESTAMP(3),
    "show_photo" BOOLEAN NOT NULL DEFAULT true,
    "show_name" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profile_cards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "cv_url" TEXT,
    "linkedin_url" TEXT,
    "github_url" TEXT,
    "portfolio_url" TEXT,
    "email" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "show_headline" BOOLEAN NOT NULL DEFAULT true,
    "show_bio" BOOLEAN NOT NULL DEFAULT true,
    "show_cv" BOOLEAN NOT NULL DEFAULT false,
    "show_linkedin" BOOLEAN NOT NULL DEFAULT true,
    "show_github" BOOLEAN NOT NULL DEFAULT true,
    "show_portfolio" BOOLEAN NOT NULL DEFAULT true,
    "show_email" BOOLEAN NOT NULL DEFAULT false,
    "show_skills" BOOLEAN NOT NULL DEFAULT true,
    "show_tools" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profile_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skills" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon_url" TEXT,
    "category" TEXT,

    CONSTRAINT "tool_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tools" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "tool_id" TEXT NOT NULL,
    "proficiency" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_follows" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_reviews" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "author_id" TEXT,
    "author_name" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "ip_hash" TEXT,
    "fingerprint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_posts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" JSONB NOT NULL,
    "cover_url" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_post_comments" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "author_id" TEXT,
    "author_name" TEXT,
    "content" TEXT NOT NULL,
    "parent_id" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spacehome_audit_log" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "metadata" JSONB,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spacehome_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_help_category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon_key" TEXT,
    "app_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_help_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_help_feature" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "category_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "youtube_url" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_help_feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_help_step" (
    "id" TEXT NOT NULL,
    "feature_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "screenshot_url" TEXT,
    "annotations" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "space_help_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_help_track" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "cover_url" TEXT,
    "level" TEXT NOT NULL DEFAULT 'beginner',
    "duration_min" INTEGER,
    "category_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "reward_stars" INTEGER NOT NULL DEFAULT 0,
    "reward_space_points" INTEGER NOT NULL DEFAULT 0,
    "reward_badge_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_help_track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_help_lesson" (
    "id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content_md" TEXT,
    "youtube_url" TEXT,
    "duration_min" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "space_help_lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_help_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "completed_lesson_ids" TEXT[],
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "space_help_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_help_badge" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "space_help_badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_space_help_badge" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "track_id" TEXT,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_space_help_badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_route_category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon_key" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_route_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_route_course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "cover_url" TEXT,
    "trailer_url" TEXT,
    "level" TEXT NOT NULL DEFAULT 'beginner',
    "duration_min" INTEGER,
    "format" TEXT NOT NULL DEFAULT 'course',
    "creator_org_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "category_id" TEXT,
    "price_stars" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "students_count" INTEGER NOT NULL DEFAULT 0,
    "reward_sp_on_complete" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_route_course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_route_module" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_route_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_route_lesson" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "module_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content_md" TEXT,
    "video_url" TEXT,
    "video_provider" TEXT,
    "video_id" TEXT,
    "duration_min" INTEGER,
    "is_free_preview" BOOLEAN NOT NULL DEFAULT false,
    "award_sp" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_route_lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_route_enrollment" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "buyer_org_id" TEXT,
    "paid_stars" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'purchase',
    "payment_ref" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "nasa_route_enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_route_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "completed_lesson_ids" TEXT[],
    "last_lesson_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "nasa_route_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_route_free_access" (
    "id" TEXT NOT NULL,
    "creator_org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT,
    "granted_by_id" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "nasa_route_free_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_route_plan" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_stars" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_route_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_route_plan_lesson" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_route_plan_lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_route_plan_attachment" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "file_key" TEXT,
    "file_size" INTEGER,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_route_plan_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_route_certificate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "course_title" TEXT NOT NULL,
    "org_name" TEXT NOT NULL,
    "duration_min" INTEGER,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_route_certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_title_catalog_title_key" ON "job_title_catalog"("title");

-- CreateIndex
CREATE UNIQUE INDEX "job_title_catalog_slug_key" ON "job_title_catalog"("slug");

-- CreateIndex
CREATE INDEX "job_title_catalog_category_level_idx" ON "job_title_catalog"("category", "level");

-- CreateIndex
CREATE INDEX "org_roles_org_id_idx" ON "org_roles"("org_id");

-- CreateIndex
CREATE INDEX "org_roles_parent_id_idx" ON "org_roles"("parent_id");

-- CreateIndex
CREATE INDEX "org_roles_org_id_public_consent_idx" ON "org_roles"("org_id", "public_consent");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_cards_user_id_key" ON "user_profile_cards"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skills_slug_key" ON "skills"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_skills_profile_id_skill_id_key" ON "user_skills"("profile_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "tool_catalog_name_key" ON "tool_catalog"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tool_catalog_slug_key" ON "tool_catalog"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_tools_profile_id_tool_id_key" ON "user_tools"("profile_id", "tool_id");

-- CreateIndex
CREATE INDEX "org_follows_org_id_idx" ON "org_follows"("org_id");

-- CreateIndex
CREATE INDEX "org_follows_user_id_idx" ON "org_follows"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_follows_org_id_user_id_key" ON "org_follows"("org_id", "user_id");

-- CreateIndex
CREATE INDEX "company_reviews_org_id_status_idx" ON "company_reviews"("org_id", "status");

-- CreateIndex
CREATE INDEX "company_reviews_created_at_idx" ON "company_reviews"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "company_posts_slug_key" ON "company_posts"("slug");

-- CreateIndex
CREATE INDEX "company_posts_org_id_is_published_published_at_idx" ON "company_posts"("org_id", "is_published", "published_at");

-- CreateIndex
CREATE INDEX "company_post_comments_post_id_created_at_idx" ON "company_post_comments"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "company_post_comments_status_idx" ON "company_post_comments"("status");

-- CreateIndex
CREATE INDEX "spacehome_audit_log_org_id_created_at_idx" ON "spacehome_audit_log"("org_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "space_help_category_slug_key" ON "space_help_category"("slug");

-- CreateIndex
CREATE INDEX "space_help_category_organization_id_order_idx" ON "space_help_category"("organization_id", "order");

-- CreateIndex
CREATE INDEX "space_help_feature_category_id_order_idx" ON "space_help_feature"("category_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "space_help_feature_category_id_slug_key" ON "space_help_feature"("category_id", "slug");

-- CreateIndex
CREATE INDEX "space_help_step_feature_id_order_idx" ON "space_help_step"("feature_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "space_help_track_slug_key" ON "space_help_track"("slug");

-- CreateIndex
CREATE INDEX "space_help_track_category_id_order_idx" ON "space_help_track"("category_id", "order");

-- CreateIndex
CREATE INDEX "space_help_lesson_track_id_order_idx" ON "space_help_lesson"("track_id", "order");

-- CreateIndex
CREATE INDEX "space_help_progress_user_id_idx" ON "space_help_progress"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "space_help_progress_user_id_track_id_key" ON "space_help_progress"("user_id", "track_id");

-- CreateIndex
CREATE UNIQUE INDEX "space_help_badge_slug_key" ON "space_help_badge"("slug");

-- CreateIndex
CREATE INDEX "user_space_help_badge_user_id_idx" ON "user_space_help_badge"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_space_help_badge_user_id_badge_id_key" ON "user_space_help_badge"("user_id", "badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_route_category_slug_key" ON "nasa_route_category"("slug");

-- CreateIndex
CREATE INDEX "nasa_route_course_creator_org_id_idx" ON "nasa_route_course"("creator_org_id");

-- CreateIndex
CREATE INDEX "nasa_route_course_category_id_idx" ON "nasa_route_course"("category_id");

-- CreateIndex
CREATE INDEX "nasa_route_course_is_published_published_at_idx" ON "nasa_route_course"("is_published", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_route_course_creator_org_id_slug_key" ON "nasa_route_course"("creator_org_id", "slug");

-- CreateIndex
CREATE INDEX "nasa_route_module_course_id_order_idx" ON "nasa_route_module"("course_id", "order");

-- CreateIndex
CREATE INDEX "nasa_route_lesson_course_id_order_idx" ON "nasa_route_lesson"("course_id", "order");

-- CreateIndex
CREATE INDEX "nasa_route_enrollment_user_id_idx" ON "nasa_route_enrollment"("user_id");

-- CreateIndex
CREATE INDEX "nasa_route_enrollment_course_id_idx" ON "nasa_route_enrollment"("course_id");

-- CreateIndex
CREATE INDEX "nasa_route_enrollment_plan_id_idx" ON "nasa_route_enrollment"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_route_enrollment_user_id_course_id_key" ON "nasa_route_enrollment"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "nasa_route_progress_user_id_idx" ON "nasa_route_progress"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_route_progress_user_id_course_id_key" ON "nasa_route_progress"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "nasa_route_free_access_creator_org_id_idx" ON "nasa_route_free_access"("creator_org_id");

-- CreateIndex
CREATE INDEX "nasa_route_free_access_user_id_idx" ON "nasa_route_free_access"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_route_free_access_creator_org_id_user_id_course_id_key" ON "nasa_route_free_access"("creator_org_id", "user_id", "course_id");

-- CreateIndex
CREATE INDEX "nasa_route_plan_course_id_order_idx" ON "nasa_route_plan"("course_id", "order");

-- CreateIndex
CREATE INDEX "nasa_route_plan_lesson_lesson_id_idx" ON "nasa_route_plan_lesson"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_route_plan_lesson_plan_id_lesson_id_key" ON "nasa_route_plan_lesson"("plan_id", "lesson_id");

-- CreateIndex
CREATE INDEX "nasa_route_plan_attachment_plan_id_order_idx" ON "nasa_route_plan_attachment"("plan_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_route_certificate_code_key" ON "nasa_route_certificate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_route_certificate_enrollment_id_key" ON "nasa_route_certificate"("enrollment_id");

-- CreateIndex
CREATE INDEX "nasa_route_certificate_user_id_idx" ON "nasa_route_certificate"("user_id");

-- CreateIndex
CREATE INDEX "nasa_route_certificate_course_id_idx" ON "nasa_route_certificate"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_nasa_page_id_key" ON "organization"("nasa_page_id");

-- CreateIndex
CREATE INDEX "actions_organization_id_is_public_published_at_idx" ON "actions"("organization_id", "is_public", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "nbox_items_public_token_key" ON "nbox_items"("public_token");

-- CreateIndex
CREATE INDEX "nbox_items_organization_id_is_public_idx" ON "nbox_items"("organization_id", "is_public");

-- AddForeignKey
ALTER TABLE "organization" ADD CONSTRAINT "organization_nasa_page_id_fkey" FOREIGN KEY ("nasa_page_id") REFERENCES "nasa_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_roles" ADD CONSTRAINT "org_roles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_roles" ADD CONSTRAINT "org_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_roles" ADD CONSTRAINT "org_roles_job_title_id_fkey" FOREIGN KEY ("job_title_id") REFERENCES "job_title_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_roles" ADD CONSTRAINT "org_roles_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "org_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile_cards" ADD CONSTRAINT "user_profile_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_profile_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tools" ADD CONSTRAINT "user_tools_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_profile_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tools" ADD CONSTRAINT "user_tools_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tool_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_follows" ADD CONSTRAINT "org_follows_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_follows" ADD CONSTRAINT "org_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_reviews" ADD CONSTRAINT "company_reviews_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_reviews" ADD CONSTRAINT "company_reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_posts" ADD CONSTRAINT "company_posts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_posts" ADD CONSTRAINT "company_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_post_comments" ADD CONSTRAINT "company_post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "company_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_post_comments" ADD CONSTRAINT "company_post_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_post_comments" ADD CONSTRAINT "company_post_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "company_post_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spacehome_audit_log" ADD CONSTRAINT "spacehome_audit_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_help_feature" ADD CONSTRAINT "space_help_feature_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "space_help_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_help_step" ADD CONSTRAINT "space_help_step_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "space_help_feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_help_track" ADD CONSTRAINT "space_help_track_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "space_help_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_help_track" ADD CONSTRAINT "space_help_track_reward_badge_id_fkey" FOREIGN KEY ("reward_badge_id") REFERENCES "space_help_badge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_help_lesson" ADD CONSTRAINT "space_help_lesson_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "space_help_track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_help_progress" ADD CONSTRAINT "space_help_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_help_progress" ADD CONSTRAINT "space_help_progress_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "space_help_track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_space_help_badge" ADD CONSTRAINT "user_space_help_badge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_space_help_badge" ADD CONSTRAINT "user_space_help_badge_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "space_help_badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_space_help_badge" ADD CONSTRAINT "user_space_help_badge_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "space_help_track"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_course" ADD CONSTRAINT "nasa_route_course_creator_org_id_fkey" FOREIGN KEY ("creator_org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_course" ADD CONSTRAINT "nasa_route_course_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_course" ADD CONSTRAINT "nasa_route_course_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "nasa_route_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_module" ADD CONSTRAINT "nasa_route_module_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "nasa_route_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_lesson" ADD CONSTRAINT "nasa_route_lesson_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "nasa_route_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_lesson" ADD CONSTRAINT "nasa_route_lesson_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "nasa_route_module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_enrollment" ADD CONSTRAINT "nasa_route_enrollment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_enrollment" ADD CONSTRAINT "nasa_route_enrollment_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "nasa_route_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_enrollment" ADD CONSTRAINT "nasa_route_enrollment_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "nasa_route_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_enrollment" ADD CONSTRAINT "nasa_route_enrollment_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_progress" ADD CONSTRAINT "nasa_route_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_progress" ADD CONSTRAINT "nasa_route_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "nasa_route_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_free_access" ADD CONSTRAINT "nasa_route_free_access_creator_org_id_fkey" FOREIGN KEY ("creator_org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_free_access" ADD CONSTRAINT "nasa_route_free_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_free_access" ADD CONSTRAINT "nasa_route_free_access_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "nasa_route_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_free_access" ADD CONSTRAINT "nasa_route_free_access_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_plan" ADD CONSTRAINT "nasa_route_plan_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "nasa_route_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_plan_lesson" ADD CONSTRAINT "nasa_route_plan_lesson_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "nasa_route_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_plan_lesson" ADD CONSTRAINT "nasa_route_plan_lesson_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "nasa_route_lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_plan_attachment" ADD CONSTRAINT "nasa_route_plan_attachment_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "nasa_route_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_certificate" ADD CONSTRAINT "nasa_route_certificate_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_certificate" ADD CONSTRAINT "nasa_route_certificate_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "nasa_route_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_certificate" ADD CONSTRAINT "nasa_route_certificate_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "nasa_route_enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

