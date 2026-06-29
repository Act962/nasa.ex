-- AlterTable
ALTER TABLE "nasa_route_course" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "ends_at" TIMESTAMP(3),
ADD COLUMN     "gtm_id" TEXT,
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pixel_id" TEXT,
ADD COLUMN     "purchase_status_id" TEXT,
ADD COLUMN     "purchase_tracking_id" TEXT,
ADD COLUMN     "redirect_url" TEXT,
ADD COLUMN     "starts_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "nasa_route_lesson" ADD COLUMN     "thumbnail_key" TEXT;

-- CreateTable
CREATE TABLE "nasa_route_lesson_attachment" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "file_key" TEXT,
    "file_name" TEXT,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_route_lesson_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nasa_route_lesson_attachment_lesson_id_order_idx" ON "nasa_route_lesson_attachment"("lesson_id", "order");

-- CreateIndex
CREATE INDEX "nasa_route_course_is_archived_idx" ON "nasa_route_course"("is_archived");

-- CreateIndex
CREATE INDEX "nasa_route_course_ends_at_idx" ON "nasa_route_course"("ends_at");

-- AddForeignKey
ALTER TABLE "nasa_route_lesson_attachment" ADD CONSTRAINT "nasa_route_lesson_attachment_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "nasa_route_lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
