-- AlterTable
ALTER TABLE "nasa_route_lesson"
  ADD COLUMN "video_file_key" TEXT,
  ADD COLUMN "video_file_size" BIGINT;

-- CreateTable
CREATE TABLE "nasa_route_video_upload" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "multipart_upload_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "total_parts" INTEGER NOT NULL,
    "cost_stars" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploading',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "nasa_route_video_upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nasa_route_video_upload_status_started_at_idx" ON "nasa_route_video_upload"("status", "started_at");

-- CreateIndex
CREATE INDEX "nasa_route_video_upload_lesson_id_idx" ON "nasa_route_video_upload"("lesson_id");

-- CreateIndex
CREATE INDEX "nasa_route_video_upload_organization_id_idx" ON "nasa_route_video_upload"("organization_id");

-- AddForeignKey
ALTER TABLE "nasa_route_video_upload" ADD CONSTRAINT "nasa_route_video_upload_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "nasa_route_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_video_upload" ADD CONSTRAINT "nasa_route_video_upload_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "nasa_route_lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_video_upload" ADD CONSTRAINT "nasa_route_video_upload_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_route_video_upload" ADD CONSTRAINT "nasa_route_video_upload_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
