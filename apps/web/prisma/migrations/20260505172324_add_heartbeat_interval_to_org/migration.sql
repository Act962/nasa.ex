-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "heartbeat_interval_seconds" INTEGER NOT NULL DEFAULT 60;
