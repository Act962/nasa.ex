-- CreateTable
CREATE TABLE "payment_goal_config" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "default_revenue_target_cents" INTEGER NOT NULL DEFAULT 0,
    "default_cash_reserve_percent" INTEGER NOT NULL DEFAULT 0,
    "alert_reserve_at_risk" BOOLEAN NOT NULL DEFAULT true,
    "alert_weekly_summary" BOOLEAN NOT NULL DEFAULT true,
    "alert_goal_reached" BOOLEAN NOT NULL DEFAULT true,
    "alert_expense_breaks_reserve" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_goal_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_goal_month" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "revenue_target_cents" INTEGER,
    "cash_reserve_percent" INTEGER,
    "reserve_risk_notified_at" TIMESTAMP(3),
    "goal_reached_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_goal_month_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_goal_config_organization_id_key" ON "payment_goal_config"("organization_id");

-- CreateIndex
CREATE INDEX "payment_goal_month_organization_id_idx" ON "payment_goal_month"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_goal_month_organization_id_year_month_key" ON "payment_goal_month"("organization_id", "year", "month");

-- AddForeignKey
ALTER TABLE "payment_goal_config" ADD CONSTRAINT "payment_goal_config_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_goal_month" ADD CONSTRAINT "payment_goal_month_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
