-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "cancelled_by" TEXT;

-- CreateTable
CREATE TABLE "scripts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scripts_tracking_id_idx" ON "scripts"("tracking_id");

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
