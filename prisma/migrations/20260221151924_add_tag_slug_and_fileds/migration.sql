/*
  Warnings:

  - A unique constraint covering the columns `[slug,organization_id,tracking_id]` on the table `tags` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `tags` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TagType" AS ENUM ('CUSTOM', 'SYSTEM');

-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "description" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "type" "TagType" NOT NULL DEFAULT 'CUSTOM';

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_organization_id_tracking_id_key" ON "tags"("slug", "organization_id", "tracking_id");
