-- AlterTable
ALTER TABLE "forge_settings" ADD COLUMN     "letterhead_footer_image" TEXT,
ADD COLUMN     "letterhead_header_image" TEXT,
ADD COLUMN     "payment_gateway_configs" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "typography_color" TEXT NOT NULL DEFAULT '#111111';
