-- CreateEnum
CREATE TYPE "WorldEventStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StarTransactionType" ADD VALUE 'EVENT_TICKET_PURCHASE';
ALTER TYPE "StarTransactionType" ADD VALUE 'EVENT_TICKET_PAYOUT';

-- CreateTable
CREATE TABLE "world_events" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cover_url" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "map_data" JSONB NOT NULL,
    "world_template_id" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 200,
    "current_occupancy" INTEGER NOT NULL DEFAULT 0,
    "ticket_price_stars" INTEGER,
    "ticket_price_brl" DECIMAL(10,2),
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "payout_percent" INTEGER NOT NULL DEFAULT 90,
    "zones" JSONB NOT NULL DEFAULT '[]',
    "status" "WorldEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_event_tickets" (
    "id" TEXT NOT NULL,
    "world_event_id" TEXT NOT NULL,
    "buyer_org_id" TEXT,
    "buyer_user_id" TEXT,
    "holder_user_id" TEXT NOT NULL,
    "price_paid_stars" INTEGER,
    "price_paid_brl" DECIMAL(10,2),
    "payment_method" TEXT NOT NULL,
    "stripe_payment_id" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'ACTIVE',
    "access_token" TEXT NOT NULL,
    "redeemed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_event_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "world_events_slug_key" ON "world_events"("slug");

-- CreateIndex
CREATE INDEX "world_events_station_id_idx" ON "world_events"("station_id");

-- CreateIndex
CREATE INDEX "world_events_status_starts_at_idx" ON "world_events"("status", "starts_at");

-- CreateIndex
CREATE INDEX "world_events_is_public_starts_at_idx" ON "world_events"("is_public", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "world_event_tickets_access_token_key" ON "world_event_tickets"("access_token");

-- CreateIndex
CREATE INDEX "world_event_tickets_holder_user_id_status_idx" ON "world_event_tickets"("holder_user_id", "status");

-- CreateIndex
CREATE INDEX "world_event_tickets_world_event_id_idx" ON "world_event_tickets"("world_event_id");

-- CreateIndex
CREATE INDEX "world_event_tickets_access_token_idx" ON "world_event_tickets"("access_token");

-- AddForeignKey
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "space_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_world_template_id_fkey" FOREIGN KEY ("world_template_id") REFERENCES "world_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_event_tickets" ADD CONSTRAINT "world_event_tickets_world_event_id_fkey" FOREIGN KEY ("world_event_id") REFERENCES "world_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
