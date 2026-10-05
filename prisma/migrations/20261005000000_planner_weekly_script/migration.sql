-- Roteiro da semana no Planner (spec 0067): objetivo do post e tema fixo por dia da semana.
ALTER TABLE "nasa_planner_posts" ADD COLUMN IF NOT EXISTS "objective" TEXT;

CREATE TABLE IF NOT EXISTS "nasa_planner_weekday_themes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "theme" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_planner_weekday_themes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "nasa_planner_weekday_themes_organization_id_weekday_key" ON "nasa_planner_weekday_themes"("organization_id", "weekday");
