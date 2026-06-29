-- CreateEnum
CREATE TYPE "WorkspaceNodeType" AS ENUM ('WS_INITIAL', 'WS_MANUAL_TRIGGER', 'WS_ACTION_CREATED', 'WS_ACTION_MOVED_COLUMN', 'WS_ACTION_TAGGED', 'WS_ACTION_COMPLETED', 'WS_ACTION_PARTICIPANT_ADDED', 'WS_CREATE_ACTION', 'WS_MOVE_ACTION', 'WS_ADD_TAG_ACTION', 'WS_ADD_PARTICIPANT', 'WS_SET_RESPONSIBLE', 'WS_CREATE_SUB_ACTION', 'WS_SEND_MESSAGE_PARTICIPANTS', 'WS_SEND_EMAIL_PARTICIPANTS', 'WS_ARCHIVE_ACTION', 'WS_WAIT', 'WS_HTTP_REQUEST', 'WS_FILTER');

-- CreateTable
CREATE TABLE "workspace_workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "user_id" TEXT,
    "workspace_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_nodes" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkspaceNodeType" NOT NULL,
    "position" JSONB NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_connections" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "from_node_id" TEXT NOT NULL,
    "to_node_id" TEXT NOT NULL,
    "fromOutput" TEXT NOT NULL DEFAULT 'main',
    "toInput" TEXT NOT NULL DEFAULT 'main',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_workflows_workspace_id_idx" ON "workspace_workflows"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_connections_from_node_id_to_node_id_fromOutput_to_key" ON "workspace_connections"("from_node_id", "to_node_id", "fromOutput", "toInput");

-- AddForeignKey
ALTER TABLE "workspace_workflows" ADD CONSTRAINT "workspace_workflows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_workflows" ADD CONSTRAINT "workspace_workflows_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_nodes" ADD CONSTRAINT "workspace_nodes_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workspace_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_connections" ADD CONSTRAINT "workspace_connections_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workspace_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_connections" ADD CONSTRAINT "workspace_connections_from_node_id_fkey" FOREIGN KEY ("from_node_id") REFERENCES "workspace_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_connections" ADD CONSTRAINT "workspace_connections_to_node_id_fkey" FOREIGN KEY ("to_node_id") REFERENCES "workspace_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
