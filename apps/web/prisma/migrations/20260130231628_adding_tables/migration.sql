/*
  Warnings:

  - You are about to drop the `message_seen` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "message_seen" DROP CONSTRAINT "message_seen_messageId_fkey";

-- DropForeignKey
ALTER TABLE "message_seen" DROP CONSTRAINT "message_seen_userId_fkey";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "last_message_id" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "seen" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "message_seen";

-- CreateIndex
CREATE INDEX "conversations_last_message_id_idx" ON "conversations"("last_message_id");
