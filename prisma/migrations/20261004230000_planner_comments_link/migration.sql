-- Planner v2, Fase 2 (spec 0059): automação do Comments ligada a cada post.
ALTER TABLE "nasa_planner_posts" ADD COLUMN IF NOT EXISTS "comments_automation_id" TEXT;
ALTER TABLE "nasa_planner_posts" ADD COLUMN IF NOT EXISTS "comments_auto_activate" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "nasa_planner_posts_comments_automation_id_idx" ON "nasa_planner_posts"("comments_automation_id");
