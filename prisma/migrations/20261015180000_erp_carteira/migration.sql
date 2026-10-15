-- Spec 0106: carteira do ERP no Órbita (aditiva).
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'ERP';

CREATE TABLE "lead_erp_profile" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerCodes" TEXT[],
    "branchCode" TEXT,
    "branchName" TEXT,
    "consultantCode" TEXT,
    "consultantName" TEXT,
    "customerSince" TIMESTAMP(3),
    "firstPurchaseAt" TIMESTAMP(3),
    "lastPurchaseAt" TIMESTAMP(3),
    "lastPurchaseAmount" DECIMAL(14,2),
    "totalPurchased" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "overdueAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "overdueInstallments" INTEGER NOT NULL DEFAULT 0,
    "oldestOverdueAt" TIMESTAMP(3),
    "interests" TEXT[],
    "lastProducts" TEXT[],
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lead_erp_profile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lead_erp_profile_leadId_key" ON "lead_erp_profile"("leadId");
CREATE INDEX "lead_erp_profile_organizationId_idx" ON "lead_erp_profile"("organizationId");
CREATE INDEX "lead_erp_profile_organizationId_consultantCode_idx" ON "lead_erp_profile"("organizationId", "consultantCode");
ALTER TABLE "lead_erp_profile" ADD CONSTRAINT "lead_erp_profile_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "erp_carteira_import" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "mode" TEXT NOT NULL DEFAULT 'full',
    "cursor" TEXT,
    "report" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastFullAt" TIMESTAMP(3),
    "lastRefreshAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "erp_carteira_import_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "erp_carteira_import_organizationId_key" ON "erp_carteira_import"("organizationId");
