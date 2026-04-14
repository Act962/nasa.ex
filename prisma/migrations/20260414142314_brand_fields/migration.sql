-- CreateEnum
CREATE TYPE "NasaCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NasaCampaignEventType" AS ENUM ('TRAINING', 'STRATEGIC_MEETING', 'REVIEW', 'KICKOFF', 'PRESENTATION', 'DEADLINE');

-- CreateEnum
CREATE TYPE "NasaCampaignEventStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "NasaCampaignBrandAssetType" AS ENUM ('LOGO', 'COLOR_PALETTE', 'FONT', 'LINK', 'DOCUMENT', 'IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "NasaCampaignTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "NasaCampaignTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ClientOnboardingStage" AS ENUM ('PAYMENT_CONFIRMED', 'FORMS_SENT', 'BRAND_FORM_DONE', 'ONBOARDING_DONE', 'KICKOFF_SCHEDULED', 'CAMPAIGN_CREATED', 'ACTIVE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IntegrationPlatform" ADD VALUE 'GOOGLE_CALENDAR';
ALTER TYPE "IntegrationPlatform" ADD VALUE 'HUGGING_FACE';
ALTER TYPE "IntegrationPlatform" ADD VALUE 'POLLINATIONS';

-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "org_project_id" TEXT;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "org_project_id" TEXT;

-- AlterTable
ALTER TABLE "forge_proposals" ADD COLUMN     "org_project_id" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "org_project_id" TEXT;

-- AlterTable
ALTER TABLE "nasa_planner" ADD COLUMN     "client_org_id" TEXT,
ADD COLUMN     "client_org_name" TEXT,
ADD COLUMN     "org_project_id" TEXT;

-- AlterTable
ALTER TABLE "nasa_planner_posts" ADD COLUMN     "campaign_id" TEXT,
ADD COLUMN     "client_org_name" TEXT,
ADD COLUMN     "org_project_id" TEXT,
ADD COLUMN     "reference_links" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "brand_ai_instructions" TEXT,
ADD COLUMN     "brand_icp" TEXT,
ADD COLUMN     "brand_positioning" TEXT,
ADD COLUMN     "brand_slogan" TEXT,
ADD COLUMN     "brand_swot" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "brand_visual" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "brand_voice_tone" TEXT,
ADD COLUMN     "brand_website" TEXT;

-- AlterTable
ALTER TABLE "space_point_rule" ADD COLUMN     "popup_template_id" TEXT;

-- AlterTable
ALTER TABLE "tracking" ADD COLUMN     "org_project_id" TEXT;

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "org_project_id" TEXT;

-- CreateTable
CREATE TABLE "star_rule" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "cooldown_hours" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "popup_template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "star_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "type" TEXT NOT NULL DEFAULT 'client',
    "description" TEXT,
    "color" TEXT DEFAULT '#7c3aed',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "slogan" TEXT,
    "website" TEXT,
    "icp" TEXT,
    "positioning" TEXT,
    "voice_tone" TEXT,
    "visual" JSONB NOT NULL DEFAULT '{}',
    "ai_instructions" TEXT,
    "swot" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_campaign_planners" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "planner_id" TEXT,
    "forge_proposal_id" TEXT,
    "org_project_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "campaign_type" TEXT,
    "status" "NasaCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "company_code" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "client_name" TEXT,
    "client_logo" TEXT,
    "color" TEXT DEFAULT '#7c3aed',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "nasa_campaign_planners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_campaign_onboardings" (
    "id" TEXT NOT NULL,
    "campaign_planner_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'forge_pending',
    "forge_completed_at" TIMESTAMP(3),
    "onboarding_started_at" TIMESTAMP(3),
    "notes" TEXT,
    "responsible_user_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_campaign_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_campaign_events" (
    "id" TEXT NOT NULL,
    "campaign_planner_id" TEXT NOT NULL,
    "event_type" "NasaCampaignEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "participants" JSONB NOT NULL DEFAULT '[]',
    "meeting_link" TEXT,
    "status" "NasaCampaignEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "linked_action_id" TEXT,
    "linked_appointment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_campaign_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_campaign_brand_assets" (
    "id" TEXT NOT NULL,
    "campaign_planner_id" TEXT NOT NULL,
    "nbox_item_id" TEXT,
    "asset_type" "NasaCampaignBrandAssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "file_path" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_campaign_brand_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_campaign_tasks" (
    "id" TEXT NOT NULL,
    "campaign_planner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigned_to" TEXT,
    "priority" "NasaCampaignTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "NasaCampaignTaskStatus" NOT NULL DEFAULT 'PENDING',
    "due_date" TIMESTAMP(3),
    "tags" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_campaign_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_campaign_public_access" (
    "id" TEXT NOT NULL,
    "campaign_planner_id" TEXT NOT NULL,
    "access_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "allowed_views" JSONB NOT NULL DEFAULT '["calendar"]',
    "expires_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_campaign_public_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_onboarding_processes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "org_project_id" TEXT,
    "proposal_id" TEXT,
    "lead_id" TEXT,
    "planner_id" TEXT,
    "campaign_id" TEXT,
    "brand_form_id" TEXT,
    "onboarding_form_id" TEXT,
    "client_portal_code" TEXT NOT NULL,
    "kickoff_link" TEXT,
    "stage" "ClientOnboardingStage" NOT NULL DEFAULT 'PAYMENT_CONFIRMED',
    "payment_confirmed_at" TIMESTAMP(3),
    "forms_sent_at" TIMESTAMP(3),
    "brand_form_done_at" TIMESTAMP(3),
    "onboarding_done_at" TIMESTAMP(3),
    "campaign_created_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_onboarding_processes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "star_rule_org_id_idx" ON "star_rule"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "star_rule_org_id_action_key" ON "star_rule"("org_id", "action");

-- CreateIndex
CREATE INDEX "org_projects_organization_id_idx" ON "org_projects"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_campaign_planners_company_code_key" ON "nasa_campaign_planners"("company_code");

-- CreateIndex
CREATE INDEX "nasa_campaign_planners_organization_id_idx" ON "nasa_campaign_planners"("organization_id");

-- CreateIndex
CREATE INDEX "nasa_campaign_planners_user_id_idx" ON "nasa_campaign_planners"("user_id");

-- CreateIndex
CREATE INDEX "nasa_campaign_planners_company_code_idx" ON "nasa_campaign_planners"("company_code");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_campaign_onboardings_campaign_planner_id_key" ON "nasa_campaign_onboardings"("campaign_planner_id");

-- CreateIndex
CREATE INDEX "nasa_campaign_events_campaign_planner_id_idx" ON "nasa_campaign_events"("campaign_planner_id");

-- CreateIndex
CREATE INDEX "nasa_campaign_events_scheduled_at_idx" ON "nasa_campaign_events"("scheduled_at");

-- CreateIndex
CREATE INDEX "nasa_campaign_brand_assets_campaign_planner_id_idx" ON "nasa_campaign_brand_assets"("campaign_planner_id");

-- CreateIndex
CREATE INDEX "nasa_campaign_tasks_campaign_planner_id_idx" ON "nasa_campaign_tasks"("campaign_planner_id");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_campaign_public_access_campaign_planner_id_key" ON "nasa_campaign_public_access"("campaign_planner_id");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_campaign_public_access_access_code_key" ON "nasa_campaign_public_access"("access_code");

-- CreateIndex
CREATE INDEX "nasa_campaign_public_access_access_code_idx" ON "nasa_campaign_public_access"("access_code");

-- CreateIndex
CREATE UNIQUE INDEX "client_onboarding_processes_proposal_id_key" ON "client_onboarding_processes"("proposal_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_onboarding_processes_client_portal_code_key" ON "client_onboarding_processes"("client_portal_code");

-- CreateIndex
CREATE INDEX "client_onboarding_processes_organization_id_idx" ON "client_onboarding_processes"("organization_id");

-- CreateIndex
CREATE INDEX "client_onboarding_processes_client_portal_code_idx" ON "client_onboarding_processes"("client_portal_code");

-- AddForeignKey
ALTER TABLE "tracking" ADD CONSTRAINT "tracking_org_project_id_fkey" FOREIGN KEY ("org_project_id") REFERENCES "org_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_org_project_id_fkey" FOREIGN KEY ("org_project_id") REFERENCES "org_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_org_project_id_fkey" FOREIGN KEY ("org_project_id") REFERENCES "org_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_org_project_id_fkey" FOREIGN KEY ("org_project_id") REFERENCES "org_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_org_project_id_fkey" FOREIGN KEY ("org_project_id") REFERENCES "org_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forge_proposals" ADD CONSTRAINT "forge_proposals_org_project_id_fkey" FOREIGN KEY ("org_project_id") REFERENCES "org_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner" ADD CONSTRAINT "nasa_planner_org_project_id_fkey" FOREIGN KEY ("org_project_id") REFERENCES "org_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_posts" ADD CONSTRAINT "nasa_planner_posts_org_project_id_fkey" FOREIGN KEY ("org_project_id") REFERENCES "org_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_planner_posts" ADD CONSTRAINT "nasa_planner_posts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "nasa_campaign_planners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "star_rule" ADD CONSTRAINT "star_rule_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_projects" ADD CONSTRAINT "org_projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_campaign_planners" ADD CONSTRAINT "nasa_campaign_planners_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_campaign_planners" ADD CONSTRAINT "nasa_campaign_planners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_campaign_planners" ADD CONSTRAINT "nasa_campaign_planners_planner_id_fkey" FOREIGN KEY ("planner_id") REFERENCES "nasa_planner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_campaign_planners" ADD CONSTRAINT "nasa_campaign_planners_forge_proposal_id_fkey" FOREIGN KEY ("forge_proposal_id") REFERENCES "forge_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_campaign_planners" ADD CONSTRAINT "nasa_campaign_planners_org_project_id_fkey" FOREIGN KEY ("org_project_id") REFERENCES "org_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_campaign_onboardings" ADD CONSTRAINT "nasa_campaign_onboardings_campaign_planner_id_fkey" FOREIGN KEY ("campaign_planner_id") REFERENCES "nasa_campaign_planners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_campaign_onboardings" ADD CONSTRAINT "nasa_campaign_onboardings_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_campaign_events" ADD CONSTRAINT "nasa_campaign_events_campaign_planner_id_fkey" FOREIGN KEY ("campaign_planner_id") REFERENCES "nasa_campaign_planners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_campaign_brand_assets" ADD CONSTRAINT "nasa_campaign_brand_assets_campaign_planner_id_fkey" FOREIGN KEY ("campaign_planner_id") REFERENCES "nasa_campaign_planners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_campaign_brand_assets" ADD CONSTRAINT "nasa_campaign_brand_assets_nbox_item_id_fkey" FOREIGN KEY ("nbox_item_id") REFERENCES "nbox_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_campaign_tasks" ADD CONSTRAINT "nasa_campaign_tasks_campaign_planner_id_fkey" FOREIGN KEY ("campaign_planner_id") REFERENCES "nasa_campaign_planners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_campaign_tasks" ADD CONSTRAINT "nasa_campaign_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_campaign_public_access" ADD CONSTRAINT "nasa_campaign_public_access_campaign_planner_id_fkey" FOREIGN KEY ("campaign_planner_id") REFERENCES "nasa_campaign_planners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_onboarding_processes" ADD CONSTRAINT "client_onboarding_processes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_onboarding_processes" ADD CONSTRAINT "client_onboarding_processes_org_project_id_fkey" FOREIGN KEY ("org_project_id") REFERENCES "org_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_onboarding_processes" ADD CONSTRAINT "client_onboarding_processes_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "forge_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_onboarding_processes" ADD CONSTRAINT "client_onboarding_processes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_onboarding_processes" ADD CONSTRAINT "client_onboarding_processes_planner_id_fkey" FOREIGN KEY ("planner_id") REFERENCES "nasa_planner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_onboarding_processes" ADD CONSTRAINT "client_onboarding_processes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "nasa_campaign_planners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_onboarding_processes" ADD CONSTRAINT "client_onboarding_processes_brand_form_id_fkey" FOREIGN KEY ("brand_form_id") REFERENCES "forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_onboarding_processes" ADD CONSTRAINT "client_onboarding_processes_onboarding_form_id_fkey" FOREIGN KEY ("onboarding_form_id") REFERENCES "forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
