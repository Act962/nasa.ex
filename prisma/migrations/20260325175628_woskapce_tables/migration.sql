/*
  Warnings:

  - Added the required column `workspace_id` to the `actions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "WorkspaceMemberRole" AS ENUM ('OWNER', 'MEMBER', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ActionPriority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "actions_closed_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "actions_end_date_idx";

-- DropIndex
DROP INDEX IF EXISTS "actions_start_date_idx";

-- DropIndex
DROP INDEX IF EXISTS "actions_type_idx";

-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "column_id" TEXT,
ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "order" DECIMAL(20,10) NOT NULL DEFAULT 0,
ADD COLUMN     "priority" "ActionPriority" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "workspace_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT DEFAULT '#1447e6',
    "icon" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "organization_id" TEXT NOT NULL,
    "tracking_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_columns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT '#1447e6',
    "order" DECIMAL(20,10) NOT NULL DEFAULT 0,
    "workspace_id" TEXT NOT NULL,

    CONSTRAINT "workspace_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "WorkspaceMemberRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspaces_organization_id_idx" ON "workspaces"("organization_id");

-- CreateIndex
CREATE INDEX "workspaces_tracking_id_idx" ON "workspaces"("tracking_id");

-- CreateIndex
CREATE INDEX "workspaces_created_by_idx" ON "workspaces"("created_by");

-- CreateIndex
CREATE INDEX "workspaces_is_archived_idx" ON "workspaces"("is_archived");

-- CreateIndex
CREATE INDEX "workspace_columns_workspace_id_order_idx" ON "workspace_columns"("workspace_id", "order");

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_idx" ON "workspace_members"("workspace_id");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "actions_workspace_id_idx" ON "actions"("workspace_id");

-- CreateIndex
CREATE INDEX "actions_column_id_idx" ON "actions"("column_id");

-- CreateIndex
CREATE INDEX "actions_priority_idx" ON "actions"("priority");

-- CreateIndex
CREATE INDEX "actions_due_date_idx" ON "actions"("due_date");

-- CreateIndex
CREATE INDEX "actions_order_idx" ON "actions"("order");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_columns" ADD CONSTRAINT "workspace_columns_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "workspace_columns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
