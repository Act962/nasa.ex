-- AlterTable
ALTER TABLE "system_activity_log" ADD COLUMN     "company_id" TEXT,
ADD COLUMN     "duration_ms" INTEGER,
ADD COLUMN     "feature_key" TEXT,
ADD COLUMN     "sub_app_slug" TEXT;

-- AlterTable
ALTER TABLE "user_presence" ADD COLUMN     "active_app_slug" TEXT,
ADD COLUMN     "active_path" TEXT,
ADD COLUMN     "active_resource" TEXT;

-- CreateTable
CREATE TABLE "user_session_rollup" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "total_online_sec" INTEGER NOT NULL DEFAULT 0,
    "total_active_sec" INTEGER NOT NULL DEFAULT 0,
    "by_app" JSONB NOT NULL DEFAULT '{}',
    "sessions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_session_rollup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_page_view" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "nick" TEXT,
    "visitor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_page_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_insight_report" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "modules" JSONB NOT NULL DEFAULT '[]',
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "ai_narrative" TEXT,
    "share_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_insight_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_report_compare" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "report_ids" TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_report_compare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_session_rollup_user_id_day_idx" ON "user_session_rollup"("user_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "user_session_rollup_organization_id_user_id_day_key" ON "user_session_rollup"("organization_id", "user_id", "day");

-- CreateIndex
CREATE INDEX "public_page_view_organization_id_page_created_at_idx" ON "public_page_view"("organization_id", "page", "created_at");

-- CreateIndex
CREATE INDEX "public_page_view_visitor_id_idx" ON "public_page_view"("visitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_insight_report_share_token_key" ON "saved_insight_report"("share_token");

-- CreateIndex
CREATE INDEX "saved_insight_report_organization_id_created_at_idx" ON "saved_insight_report"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "saved_insight_report_user_id_idx" ON "saved_insight_report"("user_id");

-- CreateIndex
CREATE INDEX "saved_report_compare_organization_id_created_at_idx" ON "saved_report_compare"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "system_activity_log_company_id_idx" ON "system_activity_log"("company_id");

-- CreateIndex
CREATE INDEX "system_activity_log_feature_key_created_at_idx" ON "system_activity_log"("feature_key", "created_at");

-- AddForeignKey
ALTER TABLE "user_session_rollup" ADD CONSTRAINT "user_session_rollup_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_page_view" ADD CONSTRAINT "public_page_view_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_insight_report" ADD CONSTRAINT "saved_insight_report_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_insight_report" ADD CONSTRAINT "saved_insight_report_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_report_compare" ADD CONSTRAINT "saved_report_compare_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_report_compare" ADD CONSTRAINT "saved_report_compare_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
