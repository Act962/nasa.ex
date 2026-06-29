-- NASA Payment — Fase 2: Governança + Cobrança automatizada
-- Aplicada manualmente em DB com drift histórico (10 migrations órfãs aplicadas
-- ao DB mas ausentes do diretório local). Não usa `prisma migrate dev` direto
-- porque o reset destruiria dados; aplicada via `prisma db execute --file` e
-- registrada no `_prisma_migrations` via `prisma migrate resolve --applied`.

-- ── ENUMS NOVOS ────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "PaymentApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentApprovalDecisionKind" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "PaymentDunningChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "PaymentDunningExecutionStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- ── ENUM EXISTENTE: FinancialEntryStatus ganha PENDING_APPROVAL ────────────
-- ALTER TYPE ... ADD VALUE não pode rodar dentro de transação implícita; Postgres
-- exige que essa instrução seja committed antes de ser usada. Prisma `db execute`
-- roda em auto-commit, então funciona standalone.

-- AlterEnum
ALTER TYPE "FinancialEntryStatus" ADD VALUE 'PENDING_APPROVAL';

-- ── ALTER TABLE: org_permission, organization, payment_entries ────────────

-- AlterTable
ALTER TABLE "org_permission" ADD COLUMN     "can_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_pay" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "nerp_financial_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payment_entries" ADD COLUMN     "approval_threshold_amount_cents" INTEGER,
ADD COLUMN     "dunning_rule_id" TEXT,
ADD COLUMN     "requires_approval" BOOLEAN NOT NULL DEFAULT false;

-- ── CREATE TABLE: governança + aprovação ──────────────────────────────────

-- CreateTable
CREATE TABLE "payment_governance_config" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "auto_approval_threshold_cents" INTEGER,
    "payable_requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "notify_approvers_after_hours" INTEGER NOT NULL DEFAULT 24,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_governance_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_approval_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PaymentApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "min_approvers" INTEGER NOT NULL DEFAULT 1,
    "decided_at" TIMESTAMP(3),
    "last_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_approval_decisions" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "decision" "PaymentApprovalDecisionKind" NOT NULL,
    "reason" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_approval_decisions_pkey" PRIMARY KEY ("id")
);

-- ── CREATE TABLE: cobrança automatizada ───────────────────────────────────

-- CreateTable
CREATE TABLE "payment_dunning_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_dunning_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_dunning_steps" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "days_offset" INTEGER NOT NULL,
    "channel" "PaymentDunningChannel" NOT NULL,
    "template_subject" TEXT,
    "template_body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_dunning_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_dunning_executions" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "executed_at" TIMESTAMP(3),
    "status" "PaymentDunningExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "PaymentDunningChannel" NOT NULL,
    "error_message" TEXT,
    "message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_dunning_executions_pkey" PRIMARY KEY ("id")
);

-- ── INDEXES (unique + non-unique) ─────────────────────────────────────────

-- CreateIndex
CREATE UNIQUE INDEX "payment_governance_config_organization_id_key" ON "payment_governance_config"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_approval_requests_entry_id_key" ON "payment_approval_requests"("entry_id");

-- CreateIndex
CREATE INDEX "payment_approval_requests_organization_id_status_idx" ON "payment_approval_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payment_approval_requests_requested_by_id_idx" ON "payment_approval_requests"("requested_by_id");

-- CreateIndex
CREATE INDEX "payment_approval_decisions_request_id_idx" ON "payment_approval_decisions"("request_id");

-- CreateIndex
CREATE INDEX "payment_approval_decisions_user_id_idx" ON "payment_approval_decisions"("user_id");

-- CreateIndex
CREATE INDEX "payment_dunning_rules_organization_id_idx" ON "payment_dunning_rules"("organization_id");

-- CreateIndex
CREATE INDEX "payment_dunning_steps_rule_id_idx" ON "payment_dunning_steps"("rule_id");

-- CreateIndex
CREATE INDEX "payment_dunning_executions_status_scheduled_for_idx" ON "payment_dunning_executions"("status", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "payment_dunning_executions_entry_id_step_id_key" ON "payment_dunning_executions"("entry_id", "step_id");

-- CreateIndex
CREATE INDEX "payment_entries_dunning_rule_id_idx" ON "payment_entries"("dunning_rule_id");

-- ── FOREIGN KEYS ──────────────────────────────────────────────────────────

-- AddForeignKey
ALTER TABLE "payment_entries" ADD CONSTRAINT "payment_entries_dunning_rule_id_fkey" FOREIGN KEY ("dunning_rule_id") REFERENCES "payment_dunning_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_governance_config" ADD CONSTRAINT "payment_governance_config_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_approval_requests" ADD CONSTRAINT "payment_approval_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_approval_requests" ADD CONSTRAINT "payment_approval_requests_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "payment_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_approval_requests" ADD CONSTRAINT "payment_approval_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_approval_decisions" ADD CONSTRAINT "payment_approval_decisions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "payment_approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_approval_decisions" ADD CONSTRAINT "payment_approval_decisions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_dunning_rules" ADD CONSTRAINT "payment_dunning_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_dunning_steps" ADD CONSTRAINT "payment_dunning_steps_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "payment_dunning_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_dunning_executions" ADD CONSTRAINT "payment_dunning_executions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "payment_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_dunning_executions" ADD CONSTRAINT "payment_dunning_executions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "payment_dunning_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
