-- CreateEnum
CREATE TYPE "Temperature" AS ENUM ('COLD', 'WARM', 'HOT', 'VERY_HOT');

-- AlterEnum
ALTER TYPE "NodeType" ADD VALUE 'TAG';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "temperature" "Temperature" NOT NULL DEFAULT 'COLD';
