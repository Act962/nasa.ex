-- Gatilho do lead (spec 0038).
DO $$ BEGIN
  CREATE TYPE "LeadTriggerTemplate" AS ENUM ('FOLLOW_UP', 'SCHEDULED_RETURN', 'PAYMENT_REMINDER', 'POST_SALE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "lead_triggers" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "lead_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "template" "LeadTriggerTemplate" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "scheduled_at" TIMESTAMP(3),
  "next_run_at" TIMESTAMP(3),
  "window_start" TEXT NOT NULL DEFAULT '08:00',
  "window_end" TEXT NOT NULL DEFAULT '18:00',
  "weekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
  "skip_when_in_service" BOOLEAN NOT NULL DEFAULT true,
  "activation_count" INTEGER NOT NULL DEFAULT 0,
  "last_fired_at" TIMESTAMP(3),
  "last_error" TEXT,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lead_triggers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lead_triggers_lead_id_template_key" ON "lead_triggers"("lead_id", "template");
CREATE INDEX IF NOT EXISTS "lead_triggers_is_active_next_run_at_idx" ON "lead_triggers"("is_active", "next_run_at");
CREATE INDEX IF NOT EXISTS "lead_triggers_organization_id_idx" ON "lead_triggers"("organization_id");

DO $$ BEGIN
  ALTER TABLE "lead_triggers" ADD CONSTRAINT "lead_triggers_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
