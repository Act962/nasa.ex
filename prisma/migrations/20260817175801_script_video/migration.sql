-- AlterTable
ALTER TABLE "scripts" ADD COLUMN     "video_file_name" TEXT,
ADD COLUMN     "video_key" TEXT,
ADD COLUMN     "video_mimetype" TEXT,
ADD COLUMN     "video_size_bytes" INTEGER;
