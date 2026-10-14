-- Ações novas dos Gatilhos Automáticos (spec 0104, D-5)
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'SALES_APPROVAL';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'CHECK_CREDIT';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'FIND_CUSTOMER_BY_DOCUMENT';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'ROUTE_TO_CONSULTANT';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'CATALOG_ORDER_ACTION';

-- CreateEnum
CREATE TYPE "SalesApprovalSector" AS ENUM ('COMMERCIAL', 'FINANCE', 'LOGISTICS', 'ACCOUNTING');

-- CreateEnum
CREATE TYPE "SalesApprovalRound" AS ENUM ('PRE_PAYMENT', 'POST_PAYMENT');

-- CreateEnum
CREATE TYPE "SalesApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ADJUSTED', 'CANCELED');

-- AlterTable
ALTER TABLE "nerp_catalog_integrations" ADD COLUMN     "approval_templates" JSONB;

-- AlterTable
ALTER TABLE "catalog_orders" ADD COLUMN     "delivery_note" TEXT,
ADD COLUMN     "delivery_promise_at" TIMESTAMP(3),
ADD COLUMN     "internal_approval_started_at" TIMESTAMP(3),
ADD COLUMN     "internal_approved_at" TIMESTAMP(3),
ADD COLUMN     "post_payment_approved_at" TIMESTAMP(3),
ADD COLUMN     "pending_delivery_change_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sales_approvers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sector" "SalesApprovalSector" NOT NULL,
    "rounds" "SalesApprovalRound"[],
    "phone_e164" TEXT NOT NULL,
    "opt_in_at" TIMESTAMP(3),
    "last_inbound_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_approvers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_order_approvals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "round" "SalesApprovalRound" NOT NULL,
    "sector" "SalesApprovalSector" NOT NULL,
    "status" "SalesApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_id" TEXT,
    "note" TEXT,
    "proposed_delivery_at" TIMESTAMP(3),
    "awaiting_note_since" TIMESTAMP(3),
    "awaiting_intent" TEXT,
    "notified_at" TIMESTAMP(3),
    "last_reminder_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_order_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_approvers_organization_id_phone_e164_idx" ON "sales_approvers"("organization_id", "phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "sales_approvers_organization_id_user_id_sector_key" ON "sales_approvers"("organization_id", "user_id", "sector");

-- CreateIndex
CREATE INDEX "catalog_order_approvals_order_id_round_idx" ON "catalog_order_approvals"("order_id", "round");

-- CreateIndex
CREATE INDEX "catalog_order_approvals_organization_id_status_idx" ON "catalog_order_approvals"("organization_id", "status");

-- CreateIndex
CREATE INDEX "leads_document_idx" ON "leads"("document");

-- AddForeignKey
ALTER TABLE "sales_approvers" ADD CONSTRAINT "sales_approvers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_approvers" ADD CONSTRAINT "sales_approvers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_order_approvals" ADD CONSTRAINT "catalog_order_approvals_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "catalog_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

