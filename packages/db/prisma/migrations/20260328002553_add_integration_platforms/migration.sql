-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IntegrationPlatform" ADD VALUE 'META';
ALTER TYPE "IntegrationPlatform" ADD VALUE 'OPENAI';
ALTER TYPE "IntegrationPlatform" ADD VALUE 'ANTHROPIC';
ALTER TYPE "IntegrationPlatform" ADD VALUE 'GEMINI';
ALTER TYPE "IntegrationPlatform" ADD VALUE 'KOMMO';
ALTER TYPE "IntegrationPlatform" ADD VALUE 'RD_STATION';
ALTER TYPE "IntegrationPlatform" ADD VALUE 'PIPEDRIVE';
