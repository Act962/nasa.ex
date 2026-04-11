-- AlterTable: Add brand fields to Organization
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "brand_slogan" TEXT;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "brand_website" TEXT;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "brand_icp" TEXT;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "brand_positioning" TEXT;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "brand_voice_tone" TEXT;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "brand_visual" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "brand_ai_instructions" TEXT;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "brand_swot" JSONB NOT NULL DEFAULT '{}';

-- AlterTable: Add brand fields to OrgProject
ALTER TABLE "org_projects" ADD COLUMN IF NOT EXISTS "slogan" TEXT;
ALTER TABLE "org_projects" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "org_projects" ADD COLUMN IF NOT EXISTS "icp" TEXT;
ALTER TABLE "org_projects" ADD COLUMN IF NOT EXISTS "positioning" TEXT;
ALTER TABLE "org_projects" ADD COLUMN IF NOT EXISTS "voice_tone" TEXT;
ALTER TABLE "org_projects" ADD COLUMN IF NOT EXISTS "visual" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "org_projects" ADD COLUMN IF NOT EXISTS "ai_instructions" TEXT;
ALTER TABLE "org_projects" ADD COLUMN IF NOT EXISTS "swot" JSONB NOT NULL DEFAULT '{}';
