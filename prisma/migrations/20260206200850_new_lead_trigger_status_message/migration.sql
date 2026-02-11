/*
  Warnings:

  - The `status` column on the `messages` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'SEEN');

-- AlterEnum
ALTER TYPE "NodeType" ADD VALUE 'NEW_LEAD';

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "status",
ADD COLUMN     "status" "MessageStatus" NOT NULL DEFAULT 'SENT';

-- CreateIndex
CREATE INDEX "messages_status_idx" ON "messages"("status");
