-- AlterTable
ALTER TABLE "nasa_route_course" ADD COLUMN     "community_invite_url" TEXT,
ADD COLUMN     "community_rules" TEXT,
ADD COLUMN     "community_type" TEXT,
ADD COLUMN     "ebook_file_key" TEXT,
ADD COLUMN     "ebook_file_name" TEXT,
ADD COLUMN     "ebook_file_size" INTEGER,
ADD COLUMN     "ebook_mime_type" TEXT,
ADD COLUMN     "ebook_page_count" INTEGER,
ADD COLUMN     "event_ends_at" TIMESTAMP(3),
ADD COLUMN     "event_location_note" TEXT,
ADD COLUMN     "event_starts_at" TIMESTAMP(3),
ADD COLUMN     "event_stream_url" TEXT,
ADD COLUMN     "event_timezone" TEXT,
ADD COLUMN     "subscription_period" TEXT;

-- CreateTable
CREATE TABLE "nasa_route_subscription" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "next_charge_at" TIMESTAMP(3) NOT NULL,
    "last_charged_at" TIMESTAMP(3),
    "failed_charge_count" INTEGER NOT NULL DEFAULT 0,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_route_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nasa_route_subscription_enrollment_id_key" ON "nasa_route_subscription"("enrollment_id");

-- CreateIndex
CREATE INDEX "nasa_route_subscription_next_charge_at_status_idx" ON "nasa_route_subscription"("next_charge_at", "status");

-- AddForeignKey
ALTER TABLE "nasa_route_subscription" ADD CONSTRAINT "nasa_route_subscription_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "nasa_route_enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
