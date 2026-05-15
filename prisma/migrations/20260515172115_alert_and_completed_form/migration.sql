-- AlterTable
ALTER TABLE "admin_notification" ADD COLUMN     "alert_rule_id" TEXT,
ADD COLUMN     "display_surface" TEXT NOT NULL DEFAULT 'bell',
ADD COLUMN     "event_payload" JSONB,
ADD COLUMN     "event_type" TEXT,
ADD COLUMN     "requires_ack" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "severity" TEXT NOT NULL DEFAULT 'info';

-- AlterTable
ALTER TABLE "admin_notification_read" ADD COLUMN     "acknowledged_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "form_responses" ADD COLUMN     "completed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "alert_rule" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "event_type" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "severity" TEXT NOT NULL DEFAULT 'info',
    "audience" JSONB NOT NULL,
    "channels" JSONB NOT NULL DEFAULT '["in_app"]',
    "display_surface" TEXT NOT NULL DEFAULT 'bell',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "cooldown_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_dispatch" (
    "id" TEXT NOT NULL,
    "alert_rule_id" TEXT NOT NULL,
    "entity_key" TEXT NOT NULL,
    "dispatched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_rule_event_type_is_active_idx" ON "alert_rule"("event_type", "is_active");

-- CreateIndex
CREATE INDEX "alert_rule_organization_id_idx" ON "alert_rule"("organization_id");

-- CreateIndex
CREATE INDEX "alert_dispatch_alert_rule_id_dispatched_at_idx" ON "alert_dispatch"("alert_rule_id", "dispatched_at");

-- CreateIndex
CREATE UNIQUE INDEX "alert_dispatch_alert_rule_id_entity_key_key" ON "alert_dispatch"("alert_rule_id", "entity_key");

-- CreateIndex
CREATE INDEX "admin_notification_severity_requires_ack_idx" ON "admin_notification"("severity", "requires_ack");

-- CreateIndex
CREATE INDEX "admin_notification_alert_rule_id_idx" ON "admin_notification"("alert_rule_id");

-- CreateIndex
CREATE INDEX "form_responses_completed_at_idx" ON "form_responses"("completed_at");

-- AddForeignKey
ALTER TABLE "admin_notification" ADD CONSTRAINT "admin_notification_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_dispatch" ADD CONSTRAINT "alert_dispatch_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
