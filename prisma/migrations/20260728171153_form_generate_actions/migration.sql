-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "form_response_id" TEXT;

-- AlterTable
ALTER TABLE "form_settings" ADD COLUMN     "generate_actions_config" JSONB;

-- CreateIndex
CREATE INDEX "actions_form_response_id_idx" ON "actions"("form_response_id");

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_form_response_id_fkey" FOREIGN KEY ("form_response_id") REFERENCES "form_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
