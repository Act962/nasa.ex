/*
  Warnings:

  - You are about to drop the column `messages_ids` on the `conversations` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[lead_id,tracking_id]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_senderId_fkey";

-- DropIndex
DROP INDEX "conversations_lead_id_key";

-- AlterTable
ALTER TABLE "conversations" DROP COLUMN "messages_ids";

-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "senderId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "conversations_lead_id_tracking_id_key" ON "conversations"("lead_id", "tracking_id");
