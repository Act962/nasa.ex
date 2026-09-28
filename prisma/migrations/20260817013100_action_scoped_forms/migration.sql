-- AlterTable
ALTER TABLE "form_responses" ADD COLUMN     "action_id" TEXT;

-- CreateTable
CREATE TABLE "action_forms" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "attached_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_forms_form_id_idx" ON "action_forms"("form_id");

-- CreateIndex
CREATE UNIQUE INDEX "action_forms_action_id_form_id_key" ON "action_forms"("action_id", "form_id");

-- CreateIndex
CREATE INDEX "form_responses_action_id_idx" ON "form_responses"("action_id");

-- CreateIndex
CREATE INDEX "form_responses_form_id_idx" ON "form_responses"("form_id");

-- CreateIndex
CREATE INDEX "form_responses_lead_id_idx" ON "form_responses"("lead_id");

-- AddForeignKey
ALTER TABLE "action_forms" ADD CONSTRAINT "action_forms_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_forms" ADD CONSTRAINT "action_forms_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_forms" ADD CONSTRAINT "action_forms_attached_by_fkey" FOREIGN KEY ("attached_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
