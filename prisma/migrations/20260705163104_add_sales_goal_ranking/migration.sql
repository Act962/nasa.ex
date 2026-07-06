-- CreateEnum
CREATE TYPE "SalesGoalPeriodType" AS ENUM ('WEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SalesGoalEntryKind" AS ENUM ('SELLER', 'BUCKET');

-- CreateTable
CREATE TABLE "sales_goal_periods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period_type" "SalesGoalPeriodType" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "source_file_name" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imported_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_goal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_goal_branches" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_goal_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_goal_entries" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "external_code" TEXT NOT NULL,
    "goal_name" TEXT NOT NULL,
    "seller_name" TEXT NOT NULL,
    "entry_kind" "SalesGoalEntryKind" NOT NULL DEFAULT 'SELLER',
    "goal_amount" DECIMAL(15,2) NOT NULL,
    "achieved_amount" DECIMAL(15,2),
    "member_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_goal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_goal_periods_organization_id_idx" ON "sales_goal_periods"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_goal_periods_organization_id_period_type_period_start_key" ON "sales_goal_periods"("organization_id", "period_type", "period_start");

-- CreateIndex
CREATE INDEX "sales_goal_branches_period_id_idx" ON "sales_goal_branches"("period_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_goal_branches_period_id_name_key" ON "sales_goal_branches"("period_id", "name");

-- CreateIndex
CREATE INDEX "sales_goal_entries_branch_id_idx" ON "sales_goal_entries"("branch_id");

-- CreateIndex
CREATE INDEX "sales_goal_entries_member_id_idx" ON "sales_goal_entries"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_goal_entries_branch_id_external_code_key" ON "sales_goal_entries"("branch_id", "external_code");

-- AddForeignKey
ALTER TABLE "sales_goal_periods" ADD CONSTRAINT "sales_goal_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_goal_branches" ADD CONSTRAINT "sales_goal_branches_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "sales_goal_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_goal_entries" ADD CONSTRAINT "sales_goal_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "sales_goal_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_goal_entries" ADD CONSTRAINT "sales_goal_entries_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
