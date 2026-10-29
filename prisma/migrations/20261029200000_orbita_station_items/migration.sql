-- CreateTable
CREATE TABLE "orbita_station_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "item_key" TEXT NOT NULL,
    "request_key" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "z" DOUBLE PRECISION NOT NULL,
    "quarter_turns" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orbita_station_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orbita_station_items_station_id_idx" ON "orbita_station_items"("station_id");

-- CreateIndex
CREATE UNIQUE INDEX "orbita_station_items_organization_id_request_key_key" ON "orbita_station_items"("organization_id", "request_key");

-- AddForeignKey
ALTER TABLE "orbita_station_items" ADD CONSTRAINT "orbita_station_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orbita_station_items" ADD CONSTRAINT "orbita_station_items_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "orbita_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

