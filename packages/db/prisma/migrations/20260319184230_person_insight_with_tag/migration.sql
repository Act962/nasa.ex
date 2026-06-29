-- CreateEnum
CREATE TYPE "WidgetType" AS ENUM ('LEADS_BY_TAG');

-- CreateTable
CREATE TABLE "widgets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "WidgetType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "widgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "widgets_organization_id_idx" ON "widgets"("organization_id");

-- AddForeignKey
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
