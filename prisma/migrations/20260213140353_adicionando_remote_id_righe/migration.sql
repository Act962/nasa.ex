/*
  Warnings:

  - A unique constraint covering the columns `[remote_jid,tracking_id]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "conversations_remote_jid_key";

-- CreateIndex
CREATE UNIQUE INDEX "conversations_remote_jid_tracking_id_key" ON "conversations"("remote_jid", "tracking_id");
