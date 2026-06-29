-- Migration: 20260406160000_plans_and_templates
-- Applied via: prisma migrate resolve --applied (tables already exist via db push)

-- AlterTable: new columns on "plans"
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "slogan" TEXT;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "billing_type" TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "benefits" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "cta_label" TEXT NOT NULL DEFAULT 'Assinar agora';
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "cta_link" TEXT;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "cta_gateway_id" TEXT;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "highlighted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "plans_slug_key" ON "plans"("slug");

-- AlterTable: new columns on "tracking"
ALTER TABLE "tracking" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
ALTER TABLE "tracking" ADD COLUMN IF NOT EXISTS "is_template" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tracking" ADD COLUMN IF NOT EXISTS "template_marked_by_moderator" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: new columns on "workspaces"
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "is_template" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "template_marked_by_moderator" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
