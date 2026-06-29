-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "senderName" TEXT;

-- CreateTable
CREATE TABLE "lead_files" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "lead_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_files_lead_id_idx" ON "lead_files"("lead_id");

-- CreateIndex
CREATE INDEX "lead_files_created_by_idx" ON "lead_files"("created_by");

-- AddForeignKey
ALTER TABLE "lead_files" ADD CONSTRAINT "lead_files_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_files" ADD CONSTRAINT "lead_files_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
