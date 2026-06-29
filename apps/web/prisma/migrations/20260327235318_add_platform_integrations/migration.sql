-- CreateEnum
CREATE TYPE "IntegrationPlatform" AS ENUM ('INSTAGRAM', 'TIKTOK', 'LINKEDIN', 'GMAIL', 'GOOGLE_MAPS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadSource" ADD VALUE 'INSTAGRAM';
ALTER TYPE "LeadSource" ADD VALUE 'TIKTOK';
ALTER TYPE "LeadSource" ADD VALUE 'LINKEDIN';
ALTER TYPE "LeadSource" ADD VALUE 'GMAIL';
ALTER TYPE "LeadSource" ADD VALUE 'GOOGLE_MAPS';

-- CreateTable
CREATE TABLE "platform_integrations" (
    "id" TEXT NOT NULL,
    "platform" "IntegrationPlatform" NOT NULL,
    "organization_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_integrations_organization_id_idx" ON "platform_integrations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_integrations_organization_id_platform_key" ON "platform_integrations"("organization_id", "platform");

-- AddForeignKey
ALTER TABLE "platform_integrations" ADD CONSTRAINT "platform_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
