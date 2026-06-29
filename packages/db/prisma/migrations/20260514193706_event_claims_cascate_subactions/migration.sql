-- CreateEnum
CREATE TYPE "EventClaimStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'ADMIN_RESOLVED');

-- CreateEnum
CREATE TYPE "EventReportReason" AS ENUM ('BRAND_MISUSE', 'FAKE', 'OFFENSIVE', 'DUPLICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "EventReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- DropForeignKey
ALTER TABLE "sub_action" DROP CONSTRAINT "sub_action_action_id_fkey";

-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "dispute_reason" TEXT,
ADD COLUMN     "is_disputed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "report_score" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by" TEXT;

-- CreateTable
CREATE TABLE "event_claims" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "claimant_user_id" TEXT,
    "claimant_org_id" TEXT,
    "claimant_email" TEXT NOT NULL,
    "claimant_name" TEXT NOT NULL,
    "response_token" TEXT NOT NULL,
    "tracking_token" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "status" "EventClaimStatus" NOT NULL DEFAULT 'PENDING',
    "creator_response" TEXT,
    "admin_note" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_reports" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "reporter_user_id" TEXT,
    "reporter_email" TEXT,
    "reporter_ip" TEXT,
    "reason" "EventReportReason" NOT NULL,
    "detail" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "status" "EventReportStatus" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_claims_response_token_key" ON "event_claims"("response_token");

-- CreateIndex
CREATE UNIQUE INDEX "event_claims_tracking_token_key" ON "event_claims"("tracking_token");

-- CreateIndex
CREATE INDEX "event_claims_action_id_status_idx" ON "event_claims"("action_id", "status");

-- CreateIndex
CREATE INDEX "event_claims_expires_at_status_idx" ON "event_claims"("expires_at", "status");

-- CreateIndex
CREATE INDEX "event_claims_claimant_email_idx" ON "event_claims"("claimant_email");

-- CreateIndex
CREATE INDEX "event_reports_action_id_status_idx" ON "event_reports"("action_id", "status");

-- CreateIndex
CREATE INDEX "event_reports_status_created_at_idx" ON "event_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "event_reports_reporter_ip_idx" ON "event_reports"("reporter_ip");

-- AddForeignKey
ALTER TABLE "event_claims" ADD CONSTRAINT "event_claims_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_reports" ADD CONSTRAINT "event_reports_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_action" ADD CONSTRAINT "sub_action_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
