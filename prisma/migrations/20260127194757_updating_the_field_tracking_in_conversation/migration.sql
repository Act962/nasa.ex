/*
  Warnings:

  - Added the required column `tracking_id` to the `conversations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "tracking_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "conversations_tracking_id_idx" ON "conversations"("tracking_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
