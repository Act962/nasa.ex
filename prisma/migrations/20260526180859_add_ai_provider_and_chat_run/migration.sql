-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'GOOGLE');

-- AlterTable
ALTER TABLE "ai_setting" ADD COLUMN     "ai_api_key" TEXT,
ADD COLUMN     "ai_api_key_last4" TEXT,
ADD COLUMN     "ai_model_id" TEXT,
ADD COLUMN     "ai_provider" "AiProvider";

-- CreateTable
CREATE TABLE "ai_chat_run" (
    "id" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "conversation_id" TEXT,
    "provider" "AiProvider",
    "model_id" TEXT NOT NULL,
    "using_custom" BOOLEAN NOT NULL DEFAULT false,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "tool_calls" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_chat_run_tracking_id_created_at_idx" ON "ai_chat_run"("tracking_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_chat_run_organization_id_created_at_idx" ON "ai_chat_run"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_chat_run" ADD CONSTRAINT "ai_chat_run_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
