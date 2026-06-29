-- CreateEnum
CREATE TYPE "StatusFlow" AS ENUM ('ACTIVE', 'WAITING', 'FINISHED');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "status_flow" "StatusFlow" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "tracking_consultant" (
    "id" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "max_flow" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tracking_consultant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracking_consultant_user_id_tracking_id_key" ON "tracking_consultant"("user_id", "tracking_id");

-- AddForeignKey
ALTER TABLE "tracking_consultant" ADD CONSTRAINT "tracking_consultant_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_consultant" ADD CONSTRAINT "tracking_consultant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
