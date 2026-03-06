/*
  Warnings:

  - You are about to drop the column `conversation_id` on the `leads` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[lead_id]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[last_message_id]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[api_key]` on the table `whatsapp_instances` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_lead_id_fkey";

-- DropIndex
DROP INDEX "conversations_last_message_id_idx";

-- DropIndex
DROP INDEX "leads_conversation_id_key";

-- DropIndex
DROP INDEX "whatsapp_instances_instance_name_organization_id_key";

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "conversation_id";

-- CreateIndex
CREATE UNIQUE INDEX "conversations_lead_id_key" ON "conversations"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_last_message_id_key" ON "conversations"("last_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_instances_api_key_key" ON "whatsapp_instances"("api_key");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_last_message_id_fkey" FOREIGN KEY ("last_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
