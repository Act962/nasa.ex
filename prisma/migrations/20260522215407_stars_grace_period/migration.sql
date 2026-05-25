-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "stars_grace_started_at" TIMESTAMP(3),
ADD COLUMN     "stars_last_alert_at" TIMESTAMP(3),
ADD COLUMN     "stars_suspended_at" TIMESTAMP(3);
