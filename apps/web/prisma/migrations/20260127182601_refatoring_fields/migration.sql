/*
  Warnings:

  - You are about to drop the `conversation_participants` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[lead_id]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `lead_id` to the `conversations` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "conversation_participants" DROP CONSTRAINT "conversation_participants_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "conversation_participants" DROP CONSTRAINT "conversation_participants_userId_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_conversation_id_fkey";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "lead_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "conversation_participants";

-- CreateIndex
CREATE UNIQUE INDEX "conversations_lead_id_key" ON "conversations"("lead_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
