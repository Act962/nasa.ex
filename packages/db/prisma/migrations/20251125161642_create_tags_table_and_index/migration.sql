/*
  Warnings:

  - A unique constraint covering the columns `[userId,organizationId]` on the table `member` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."leads" ADD COLUMN     "profile" TEXT;

-- AlterTable
ALTER TABLE "public"."status" ALTER COLUMN "color" SET DEFAULT '#1447e6';

-- AlterTable
ALTER TABLE "public"."tracking" ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT '#1447e6',
    "organization_id" TEXT NOT NULL,
    "tracking_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lead_tags" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tags_organization_id_idx" ON "public"."tags"("organization_id");

-- CreateIndex
CREATE INDEX "tags_tracking_id_idx" ON "public"."tags"("tracking_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_organization_id_tracking_id_key" ON "public"."tags"("name", "organization_id", "tracking_id");

-- CreateIndex
CREATE INDEX "lead_tags_lead_id_idx" ON "public"."lead_tags"("lead_id");

-- CreateIndex
CREATE INDEX "lead_tags_tag_id_idx" ON "public"."lead_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_tags_lead_id_tag_id_key" ON "public"."lead_tags"("lead_id", "tag_id");

-- CreateIndex
CREATE INDEX "leads_tracking_id_idx" ON "public"."leads"("tracking_id");

-- CreateIndex
CREATE INDEX "leads_status_id_idx" ON "public"."leads"("status_id");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "public"."leads"("email");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "public"."leads"("created_at");

-- CreateIndex
CREATE INDEX "member_organizationId_idx" ON "public"."member"("organizationId");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "public"."member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "member_userId_organizationId_key" ON "public"."member"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "status_tracking_id_order_idx" ON "public"."status"("tracking_id", "order");

-- AddForeignKey
ALTER TABLE "public"."tags" ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tags" ADD CONSTRAINT "tags_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "public"."tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_tags" ADD CONSTRAINT "lead_tags_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_tags" ADD CONSTRAINT "lead_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
