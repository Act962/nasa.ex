-- AlterTable
ALTER TABLE "router_payment_settings" ADD COLUMN     "astro_model_markup_percent" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "astro_platform_model_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterEnum
ALTER TYPE "AiCreditEntryKind" ADD VALUE 'FREE_TIER';
