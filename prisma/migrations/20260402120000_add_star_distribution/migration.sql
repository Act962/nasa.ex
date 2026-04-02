-- Add star_distribution_mode to organization table
ALTER TABLE "organization"
  ADD COLUMN IF NOT EXISTS "star_distribution_mode" TEXT NOT NULL DEFAULT 'org';

-- Create member_star_budgets table
CREATE TABLE IF NOT EXISTS "member_star_budgets" (
  "id"              TEXT        NOT NULL,
  "organization_id" TEXT        NOT NULL,
  "user_id"         TEXT        NOT NULL,
  "monthly_budget"  INTEGER     NOT NULL DEFAULT 0,
  "current_usage"   INTEGER     NOT NULL DEFAULT 0,
  "cycle_start"     TIMESTAMP(3),
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "member_star_budgets_pkey"
    PRIMARY KEY ("id"),
  CONSTRAINT "member_star_budgets_organization_id_user_id_key"
    UNIQUE ("organization_id", "user_id"),
  CONSTRAINT "member_star_budgets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "member_star_budgets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "member_star_budgets_organization_id_idx"
  ON "member_star_budgets"("organization_id");
