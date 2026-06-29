/*
  Warnings:

  - You are about to drop the `workspace_connections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workspace_nodes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workspace_workflows` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NodeType" ADD VALUE 'WS_INITIAL';
ALTER TYPE "NodeType" ADD VALUE 'WS_MANUAL_TRIGGER';
ALTER TYPE "NodeType" ADD VALUE 'WS_ACTION_CREATED';
ALTER TYPE "NodeType" ADD VALUE 'WS_ACTION_MOVED_COLUMN';
ALTER TYPE "NodeType" ADD VALUE 'WS_ACTION_TAGGED';
ALTER TYPE "NodeType" ADD VALUE 'WS_ACTION_COMPLETED';
ALTER TYPE "NodeType" ADD VALUE 'WS_ACTION_PARTICIPANT_ADDED';
ALTER TYPE "NodeType" ADD VALUE 'WS_CREATE_ACTION';
ALTER TYPE "NodeType" ADD VALUE 'WS_MOVE_ACTION';
ALTER TYPE "NodeType" ADD VALUE 'WS_ADD_TAG_ACTION';
ALTER TYPE "NodeType" ADD VALUE 'WS_ADD_PARTICIPANT';
ALTER TYPE "NodeType" ADD VALUE 'WS_SET_RESPONSIBLE';
ALTER TYPE "NodeType" ADD VALUE 'WS_CREATE_SUB_ACTION';
ALTER TYPE "NodeType" ADD VALUE 'WS_SEND_MESSAGE_PARTICIPANTS';
ALTER TYPE "NodeType" ADD VALUE 'WS_SEND_EMAIL_PARTICIPANTS';
ALTER TYPE "NodeType" ADD VALUE 'WS_ARCHIVE_ACTION';
ALTER TYPE "NodeType" ADD VALUE 'WS_WAIT';
ALTER TYPE "NodeType" ADD VALUE 'WS_HTTP_REQUEST';
ALTER TYPE "NodeType" ADD VALUE 'WS_FILTER';

-- DropForeignKey
ALTER TABLE "workspace_connections" DROP CONSTRAINT "workspace_connections_from_node_id_fkey";

-- DropForeignKey
ALTER TABLE "workspace_connections" DROP CONSTRAINT "workspace_connections_to_node_id_fkey";

-- DropForeignKey
ALTER TABLE "workspace_connections" DROP CONSTRAINT "workspace_connections_workflow_id_fkey";

-- DropForeignKey
ALTER TABLE "workspace_nodes" DROP CONSTRAINT "workspace_nodes_workflow_id_fkey";

-- DropForeignKey
ALTER TABLE "workspace_workflows" DROP CONSTRAINT "workspace_workflows_user_id_fkey";

-- DropForeignKey
ALTER TABLE "workspace_workflows" DROP CONSTRAINT "workspace_workflows_workspace_id_fkey";

-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "workspace_id" TEXT,
ALTER COLUMN "tracking_id" DROP NOT NULL;

-- DropTable
DROP TABLE "workspace_connections";

-- DropTable
DROP TABLE "workspace_nodes";

-- DropTable
DROP TABLE "workspace_workflows";

-- DropEnum
DROP TYPE "WorkspaceNodeType";

-- CreateIndex
CREATE INDEX "workflows_tracking_id_idx" ON "workflows"("tracking_id");

-- CreateIndex
CREATE INDEX "workflows_workspace_id_idx" ON "workflows"("workspace_id");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint: workflow must belong to exactly one of tracking OR workspace
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_owner_xor"
  CHECK (("tracking_id" IS NULL) <> ("workspace_id" IS NULL));
