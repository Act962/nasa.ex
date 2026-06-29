-- AlterTable
ALTER TABLE "nasa_route_course" ADD COLUMN     "purchase_email_body_json" JSONB,
ADD COLUMN     "purchase_email_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "purchase_email_subject" TEXT;
