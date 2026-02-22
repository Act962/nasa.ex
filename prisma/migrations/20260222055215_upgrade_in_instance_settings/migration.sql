/*
  Warnings:

  - A unique constraint covering the columns `[tracking_id]` on the table `whatsapp_instances` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "whatsapp_instances" DROP CONSTRAINT "whatsapp_instances_tracking_id_fkey";

-- AlterTable
ALTER TABLE "whatsapp_instances" ADD COLUMN     "is_business" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_instances_tracking_id_key" ON "whatsapp_instances"("tracking_id");

-- AddForeignKey
ALTER TABLE "whatsapp_instances" ADD CONSTRAINT "whatsapp_instances_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
