-- CreateEnum
CREATE TYPE "AiAgentMode" AS ENUM ('AUTO', 'TRIGGER', 'MANUAL');

-- CreateEnum
CREATE TYPE "AiKnowledgeStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

-- CreateTable
CREATE TABLE "ai_agent_config" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "agent_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" "AiAgentMode" NOT NULL DEFAULT 'MANUAL',
    "knowledge_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_agent_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_session" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "context" JSONB,
    "last_agent_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_knowledge" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "file_url" TEXT,
    "status" "AiKnowledgeStatus" NOT NULL DEFAULT 'PENDING',
    "chunks_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_knowledge_chunk" (
    "id" TEXT NOT NULL,
    "knowledge_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_knowledge_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_agent_config_organization_id_idx" ON "ai_agent_config"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_agent_config_organization_id_agent_key_key" ON "ai_agent_config"("organization_id", "agent_key");

-- CreateIndex
CREATE INDEX "ai_session_organization_id_user_id_updated_at_idx" ON "ai_session"("organization_id", "user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "ai_knowledge_organization_id_idx" ON "ai_knowledge"("organization_id");

-- CreateIndex
CREATE INDEX "ai_knowledge_status_idx" ON "ai_knowledge"("status");

-- CreateIndex
CREATE INDEX "ai_knowledge_chunk_organization_id_idx" ON "ai_knowledge_chunk"("organization_id");

-- CreateIndex
CREATE INDEX "ai_knowledge_chunk_knowledge_id_idx" ON "ai_knowledge_chunk"("knowledge_id");

-- AddForeignKey
ALTER TABLE "ai_agent_config" ADD CONSTRAINT "ai_agent_config_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_session" ADD CONSTRAINT "ai_session_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_session" ADD CONSTRAINT "ai_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_knowledge" ADD CONSTRAINT "ai_knowledge_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_knowledge" ADD CONSTRAINT "ai_knowledge_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_knowledge_chunk" ADD CONSTRAINT "ai_knowledge_chunk_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "ai_knowledge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
