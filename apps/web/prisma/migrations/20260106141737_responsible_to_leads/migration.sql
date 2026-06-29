-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "responsible_id" TEXT;

-- CreateIndex
CREATE INDEX "leads_responsible_id_idx" ON "leads"("responsible_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
