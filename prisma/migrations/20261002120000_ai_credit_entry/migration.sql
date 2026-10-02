-- CreateEnum
CREATE TYPE "AiCreditEntryKind" AS ENUM ('TOPUP', 'BALANCE_SNAPSHOT');

-- CreateTable
CREATE TABLE "ai_credit_entry" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "provider" TEXT NOT NULL,
    "kind" "AiCreditEntryKind" NOT NULL,
    "amount_usd" DECIMAL(12,2) NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_credit_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_credit_entry_organization_id_provider_effective_at_idx" ON "ai_credit_entry"("organization_id", "provider", "effective_at");

-- AddForeignKey
ALTER TABLE "ai_credit_entry" ADD CONSTRAINT "ai_credit_entry_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
