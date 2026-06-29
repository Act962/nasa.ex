-- CreateEnum
CREATE TYPE "NasaPostStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "NasaPostType" AS ENUM ('STATIC', 'CAROUSEL', 'REEL', 'STORY');

-- CreateTable
CREATE TABLE "nasa_post_brand_configs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_post_brand_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_posts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "type" "NasaPostType" NOT NULL DEFAULT 'STATIC',
    "status" "NasaPostStatus" NOT NULL DEFAULT 'DRAFT',
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

    CONSTRAINT "nasa_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_post_slides" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "image_key" TEXT,
    "headline" TEXT,
    "subtext" TEXT,
    "overlay_config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_post_slides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nasa_post_brand_configs_organization_id_key" ON "nasa_post_brand_configs"("organization_id");

-- CreateIndex
CREATE INDEX "nasa_posts_organization_id_status_idx" ON "nasa_posts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "nasa_posts_organization_id_scheduled_at_idx" ON "nasa_posts"("organization_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "nasa_post_slides_post_id_order_idx" ON "nasa_post_slides"("post_id", "order");

-- AddForeignKey
ALTER TABLE "nasa_post_brand_configs" ADD CONSTRAINT "nasa_post_brand_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_posts" ADD CONSTRAINT "nasa_posts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_posts" ADD CONSTRAINT "nasa_posts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_post_slides" ADD CONSTRAINT "nasa_post_slides_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "nasa_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
