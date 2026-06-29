/*
  Warnings:

  - You are about to drop the column `formId` on the `forms` table. All the data in the column will be lost.
  - You are about to drop the column `tracking_id` on the `forms` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[formId]` on the table `form_settings` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[settingsId]` on the table `forms` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "forms" DROP CONSTRAINT "forms_settingsId_fkey";

-- DropForeignKey
ALTER TABLE "forms" DROP CONSTRAINT "forms_tracking_id_fkey";

-- DropIndex
DROP INDEX "forms_formId_key";

-- AlterTable
ALTER TABLE "form_settings" ADD COLUMN     "formId" TEXT,
ADD COLUMN     "status_id" TEXT,
ADD COLUMN     "tracking_id" TEXT;

-- AlterTable
ALTER TABLE "forms" DROP COLUMN "formId",
DROP COLUMN "tracking_id",
ALTER COLUMN "settingsId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "form_settings_formId_key" ON "form_settings"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "forms_settingsId_key" ON "forms"("settingsId");

-- AddForeignKey
ALTER TABLE "form_settings" ADD CONSTRAINT "form_settings_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_settings" ADD CONSTRAINT "form_settings_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_settings" ADD CONSTRAINT "form_settings_formId_fkey" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
