-- CreateEnum
CREATE TYPE "WhatsAppProvider" AS ENUM ('UAZAPI', 'META_CLOUD');

-- AlterTable
ALTER TABLE "whatsapp_instances" ADD COLUMN     "meta_access_token" TEXT,
ADD COLUMN     "meta_app_secret" TEXT,
ADD COLUMN     "meta_business_account_id" TEXT,
ADD COLUMN     "meta_phone_number_id" TEXT,
ADD COLUMN     "meta_verify_token" TEXT,
ADD COLUMN     "provider" "WhatsAppProvider" NOT NULL DEFAULT 'UAZAPI';

-- CreateIndex
CREATE INDEX "whatsapp_instances_provider_idx" ON "whatsapp_instances"("provider");
