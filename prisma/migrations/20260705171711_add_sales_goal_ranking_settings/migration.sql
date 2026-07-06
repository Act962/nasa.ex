-- CreateEnum
CREATE TYPE "SalesGoalRankingTheme" AS ENUM ('GAMING', 'LIGHT', 'DARK', 'GALAXY');

-- AlterEnum
ALTER TYPE "SalesGoalPeriodType" ADD VALUE 'DAILY';

-- AlterTable
ALTER TABLE "sales_goal_branches" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "sales_goal_ranking_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL DEFAULT 'Ranking de Equipes',
    "theme" "SalesGoalRankingTheme" NOT NULL DEFAULT 'GAMING',
    "active_period_types" "SalesGoalPeriodType"[],
    "sound_enabled" BOOLEAN NOT NULL DEFAULT true,
    "score_sound_url" TEXT,
    "overtake_sound_url" TEXT,
    "sound_volume" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "prizes" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_goal_ranking_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_goal_ranking_settings_organization_id_key" ON "sales_goal_ranking_settings"("organization_id");

-- AddForeignKey
ALTER TABLE "sales_goal_ranking_settings" ADD CONSTRAINT "sales_goal_ranking_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
