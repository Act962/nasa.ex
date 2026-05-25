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

-- AddForeignKey
ALTER TABLE "nasa_route_lesson_attachment" ADD CONSTRAINT "nasa_route_lesson_attachment_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "nasa_route_lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
