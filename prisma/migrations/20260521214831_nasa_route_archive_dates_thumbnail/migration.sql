-- AlterTable
ALTER TABLE "nasa_route_course" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "ends_at" TIMESTAMP(3),
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "starts_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "nasa_route_lesson" ADD COLUMN     "thumbnail_key" TEXT;

-- CreateIndex
CREATE INDEX "nasa_route_course_is_archived_idx" ON "nasa_route_course"("is_archived");

-- CreateIndex
CREATE INDEX "nasa_route_course_ends_at_idx" ON "nasa_route_course"("ends_at");
