-- AlterEnum
ALTER TYPE "MessageStatus" ADD VALUE 'DELETED';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
