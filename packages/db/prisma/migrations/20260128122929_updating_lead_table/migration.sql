-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('DEFAULT', 'WHATSAPP', 'FORM', 'AGENDA', 'OTHER');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "document" TEXT,
ADD COLUMN     "source" "LeadSource" NOT NULL DEFAULT 'DEFAULT';
