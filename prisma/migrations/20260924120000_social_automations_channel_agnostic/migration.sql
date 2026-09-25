-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('INSTAGRAM');

-- CreateEnum
CREATE TYPE "SocialChannelStatus" AS ENUM ('ACTIVE', 'NEEDS_RECONNECT', 'DISABLED');

-- CreateEnum
CREATE TYPE "SocialContentType" AS ENUM ('IMAGE', 'VIDEO', 'CAROUSEL', 'REEL', 'STORY', 'OTHER');

-- CreateEnum
CREATE TYPE "SocialEventType" AS ENUM ('COMMENT_CREATED', 'DIRECT_MESSAGE_RECEIVED');

-- CreateEnum
CREATE TYPE "SocialTargetScope" AS ENUM ('ALL_CONTENT', 'SPECIFIC_CONTENT', 'NEXT_CONTENT');

-- CreateEnum
CREATE TYPE "SocialMatchKind" AS ENUM ('INCLUDE', 'EXCLUDE');

-- CreateEnum
CREATE TYPE "SocialMatchOperator" AS ENUM ('ANY_TEXT', 'CONTAINS', 'EXACT', 'STARTS_WITH');

-- CreateEnum
CREATE TYPE "SocialMatchLogic" AS ENUM ('ANY_RULE', 'ALL_RULES');

-- CreateEnum
CREATE TYPE "SocialStepKind" AS ENUM ('SEND_DIRECT_MESSAGE', 'REPLY_TO_COMMENT');

-- CreateEnum
CREATE TYPE "SocialInboundStatus" AS ENUM ('RECEIVED', 'MATCHED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialRunStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "social_channels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "external_account_id" TEXT NOT NULL,
    "webhook_path_token" TEXT NOT NULL,
    "handle" TEXT,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "credentials" TEXT NOT NULL,
    "status" "SocialChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_error_message" TEXT,
    "last_error_at" TIMESTAMP(3),
    "connected_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_contacts" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "external_user_id" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT,
    "avatar_url" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_inbound_at" TIMESTAMP(3),
    "last_outbound_at" TIMESTAMP(3),
    "lead_id" TEXT,

    CONSTRAINT "social_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_automations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Sem título',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_triggers" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "event_type" "SocialEventType" NOT NULL,
    "target_scope" "SocialTargetScope" NOT NULL DEFAULT 'ALL_CONTENT',
    "match_logic" "SocialMatchLogic" NOT NULL DEFAULT 'ANY_RULE',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_trigger_targets" (
    "id" TEXT NOT NULL,
    "trigger_id" TEXT NOT NULL,
    "external_content_id" TEXT NOT NULL,
    "content_type" "SocialContentType" NOT NULL DEFAULT 'OTHER',
    "permalink" TEXT,
    "caption" TEXT,
    "media_url" TEXT,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_trigger_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_match_rules" (
    "id" TEXT NOT NULL,
    "trigger_id" TEXT NOT NULL,
    "kind" "SocialMatchKind" NOT NULL DEFAULT 'INCLUDE',
    "operator" "SocialMatchOperator" NOT NULL DEFAULT 'CONTAINS',
    "terms" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_match_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_flow_steps" (
    "id" TEXT NOT NULL,
    "trigger_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "kind" "SocialStepKind" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "parent_step_id" TEXT,
    "branch_key" TEXT DEFAULT 'main',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_flow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_inbound_events" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "event_type" "SocialEventType" NOT NULL,
    "external_user_id" TEXT,
    "external_content_id" TEXT,
    "status" "SocialInboundStatus" NOT NULL DEFAULT 'RECEIVED',
    "skip_reason" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_inbound_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_automation_runs" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "trigger_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "inbound_event_id" TEXT,
    "contact_id" TEXT,
    "status" "SocialRunStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "social_automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_step_runs" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_id" TEXT,
    "kind" "SocialStepKind" NOT NULL,
    "status" "SocialRunStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "external_message_id" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_step_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_channels_webhook_path_token_key" ON "social_channels"("webhook_path_token");

-- CreateIndex
CREATE INDEX "social_channels_organization_id_provider_idx" ON "social_channels"("organization_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "social_channels_provider_external_account_id_key" ON "social_channels"("provider", "external_account_id");

-- CreateIndex
CREATE INDEX "social_contacts_channel_id_last_inbound_at_idx" ON "social_contacts"("channel_id", "last_inbound_at");

-- CreateIndex
CREATE INDEX "social_contacts_lead_id_idx" ON "social_contacts"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_contacts_channel_id_external_user_id_key" ON "social_contacts"("channel_id", "external_user_id");

-- CreateIndex
CREATE INDEX "social_automations_channel_id_is_active_idx" ON "social_automations"("channel_id", "is_active");

-- CreateIndex
CREATE INDEX "social_automations_organization_id_idx" ON "social_automations"("organization_id");

-- CreateIndex
CREATE INDEX "social_triggers_automation_id_event_type_idx" ON "social_triggers"("automation_id", "event_type");

-- CreateIndex
CREATE INDEX "social_trigger_targets_external_content_id_idx" ON "social_trigger_targets"("external_content_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_trigger_targets_trigger_id_external_content_id_key" ON "social_trigger_targets"("trigger_id", "external_content_id");

-- CreateIndex
CREATE INDEX "social_match_rules_trigger_id_idx" ON "social_match_rules"("trigger_id");

-- CreateIndex
CREATE INDEX "social_flow_steps_trigger_id_order_idx" ON "social_flow_steps"("trigger_id", "order");

-- CreateIndex
CREATE INDEX "social_flow_steps_parent_step_id_idx" ON "social_flow_steps"("parent_step_id");

-- CreateIndex
CREATE INDEX "social_inbound_events_channel_id_received_at_idx" ON "social_inbound_events"("channel_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "social_inbound_events_provider_external_event_id_key" ON "social_inbound_events"("provider", "external_event_id");

-- CreateIndex
CREATE INDEX "social_automation_runs_automation_id_started_at_idx" ON "social_automation_runs"("automation_id", "started_at");

-- CreateIndex
CREATE INDEX "social_automation_runs_channel_id_started_at_idx" ON "social_automation_runs"("channel_id", "started_at");

-- CreateIndex
CREATE INDEX "social_automation_runs_contact_id_idx" ON "social_automation_runs"("contact_id");

-- CreateIndex
CREATE INDEX "social_automation_runs_inbound_event_id_idx" ON "social_automation_runs"("inbound_event_id");

-- CreateIndex
CREATE INDEX "social_step_runs_run_id_idx" ON "social_step_runs"("run_id");

-- CreateIndex
CREATE INDEX "social_step_runs_step_id_idx" ON "social_step_runs"("step_id");

-- AddForeignKey
ALTER TABLE "social_channels" ADD CONSTRAINT "social_channels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_contacts" ADD CONSTRAINT "social_contacts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "social_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_automations" ADD CONSTRAINT "social_automations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "social_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_triggers" ADD CONSTRAINT "social_triggers_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "social_automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_trigger_targets" ADD CONSTRAINT "social_trigger_targets_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "social_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_match_rules" ADD CONSTRAINT "social_match_rules_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "social_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_flow_steps" ADD CONSTRAINT "social_flow_steps_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "social_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_flow_steps" ADD CONSTRAINT "social_flow_steps_parent_step_id_fkey" FOREIGN KEY ("parent_step_id") REFERENCES "social_flow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_inbound_events" ADD CONSTRAINT "social_inbound_events_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "social_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_automation_runs" ADD CONSTRAINT "social_automation_runs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "social_automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_automation_runs" ADD CONSTRAINT "social_automation_runs_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "social_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_automation_runs" ADD CONSTRAINT "social_automation_runs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "social_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_automation_runs" ADD CONSTRAINT "social_automation_runs_inbound_event_id_fkey" FOREIGN KEY ("inbound_event_id") REFERENCES "social_inbound_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_automation_runs" ADD CONSTRAINT "social_automation_runs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "social_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_step_runs" ADD CONSTRAINT "social_step_runs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "social_automation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_step_runs" ADD CONSTRAINT "social_step_runs_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "social_flow_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

