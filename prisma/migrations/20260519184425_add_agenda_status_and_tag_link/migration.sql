-- AlterTable
ALTER TABLE "agendas" ADD COLUMN     "status_id" TEXT;

-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "agenda_id" TEXT;

-- CreateIndex
CREATE INDEX "agendas_status_id_idx" ON "agendas"("status_id");

-- CreateIndex
CREATE INDEX "tags_agenda_id_idx" ON "tags"("agenda_id");

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "agendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendas" ADD CONSTRAINT "agendas_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "status"("id") ON DELETE SET NULL ON UPDATE CASCADE;
