-- CreateTable
CREATE TABLE "station_messages" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_name" TEXT NOT NULL,
    "sender_image" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "station_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "station_messages_station_id_created_at_idx" ON "station_messages"("station_id", "created_at");

-- AddForeignKey
ALTER TABLE "station_messages" ADD CONSTRAINT "station_messages_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "space_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
