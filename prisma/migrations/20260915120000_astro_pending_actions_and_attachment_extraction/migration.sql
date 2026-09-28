-- spec 0014 — Astro como agente financeiro (Fase 1).
-- Migration puramente aditiva: enums + tabela de propostas do Astro e colunas
-- nulas no anexo financeiro. Nenhuma coluna existente é alterada.
-- Rollback:
--   ALTER TABLE "payment_attachments" DROP COLUMN "extraction", DROP COLUMN "extracted_at",
--     DROP COLUMN "source_channel", DROP COLUMN "original_file_name";
--   DROP TABLE "astro_pending_actions";
--   DROP TYPE "AstroPendingActionStatus"; DROP TYPE "AstroActionChannel";

-- CreateEnum
CREATE TYPE "AstroActionChannel" AS ENUM ('CHAT', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "AstroPendingActionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- AlterTable
ALTER TABLE "payment_attachments"
  ADD COLUMN "extraction" JSONB,
  ADD COLUMN "extracted_at" TIMESTAMP(3),
  ADD COLUMN "source_channel" TEXT,
  ADD COLUMN "original_file_name" TEXT;

-- CreateTable
CREATE TABLE "astro_pending_actions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" "AstroActionChannel" NOT NULL DEFAULT 'CHAT',
    "session_id" TEXT,
    "action_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "AstroPendingActionStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "result" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astro_pending_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "astro_pending_actions_org_user_status_created_idx"
  ON "astro_pending_actions"("organization_id", "user_id", "status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "astro_pending_actions" ADD CONSTRAINT "astro_pending_actions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astro_pending_actions" ADD CONSTRAINT "astro_pending_actions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
