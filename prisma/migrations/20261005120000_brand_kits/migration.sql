-- AlterTable
ALTER TABLE "brand_kit_assets" ADD COLUMN     "brand_kit_id" TEXT;
-- AlterTable
ALTER TABLE "social_channels" ADD COLUMN     "brand_kit_id" TEXT;
-- CreateTable
CREATE TABLE "brand_kits" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "brand_name" TEXT,
    "logos" JSONB NOT NULL DEFAULT '{}',
    "palette" TEXT[],
    "font_heading" TEXT,
    "font_body" TEXT,
    "voice_tone" TEXT,
    "audience" TEXT,
    "positioning" TEXT,
    "slogan" TEXT,
    "website" TEXT,
    "key_messages" TEXT[],
    "forbidden_words" TEXT[],
    "default_hashtags" TEXT[],
    "default_ctas" TEXT[],
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "brand_kits_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "brand_kits_organization_id_name_key_key" ON "brand_kits"("organization_id", "name_key");
-- CreateIndex
CREATE INDEX "brand_kit_assets_brand_kit_id_idx" ON "brand_kit_assets"("brand_kit_id");
-- AddForeignKey
ALTER TABLE "brand_kit_assets" ADD CONSTRAINT "brand_kit_assets_brand_kit_id_fkey" FOREIGN KEY ("brand_kit_id") REFERENCES "brand_kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "social_channels" ADD CONSTRAINT "social_channels_brand_kit_id_fkey" FOREIGN KEY ("brand_kit_id") REFERENCES "brand_kits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
