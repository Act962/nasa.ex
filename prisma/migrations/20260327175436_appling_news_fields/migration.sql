/*
  Warnings:

  - You are about to drop the column `jsonReponse` on the `form_responses` table. All the data in the column will be lost.
  - Made the column `formId` on table `form_settings` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "form_responses" DROP COLUMN "jsonReponse",
ADD COLUMN     "jsonResponse" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "lead_id" TEXT;

-- AlterTable
ALTER TABLE "form_settings" ADD COLUMN     "background_image" TEXT,
ADD COLUMN     "finish_message" TEXT NOT NULL DEFAULT 'Obrigado por seu cadastro!',
ADD COLUMN     "id_pixel" TEXT,
ADD COLUMN     "id_tag_manager" TEXT,
ADD COLUMN     "need_login" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "redirect_url" TEXT,
ADD COLUMN     "show_email" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_name" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_phone" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "formId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
