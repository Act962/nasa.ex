/*
  Warnings:

  - You are about to drop the column `submissions` on the `forms` table. All the data in the column will be lost.
  - You are about to drop the column `visits` on the `forms` table. All the data in the column will be lost.
  - You are about to drop the `form_submissions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[formId]` on the table `forms` will be added. If there are existing duplicate values, this will fail.
  - The required column `formId` was added to the `forms` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `organizationId` to the `forms` table without a default value. This is not possible if the table is not empty.
  - Added the required column `settingsId` to the `forms` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "form_submissions" DROP CONSTRAINT "form_submissions_form_id_fkey";

-- AlterTable
ALTER TABLE "forms" DROP COLUMN "submissions",
DROP COLUMN "visits",
ADD COLUMN     "formId" TEXT NOT NULL,
ADD COLUMN     "jsonBlock" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "responses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "settingsId" TEXT NOT NULL,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "tracking_id" DROP NOT NULL;

-- DropTable
DROP TABLE "form_submissions";

-- CreateTable
CREATE TABLE "form_settings" (
    "id" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "backgroundColor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_responses" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jsonReponse" JSONB NOT NULL,

    CONSTRAINT "form_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forms_formId_key" ON "forms"("formId");

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "form_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
