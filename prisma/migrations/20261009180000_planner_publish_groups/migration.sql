-- Planner: mesmo conteúdo em várias contas do Instagram (spec 0074). Só aditiva.
ALTER TABLE "nasa_planner_posts"
  ADD COLUMN "publish_group_id" TEXT,
  ADD COLUMN "is_group_content_detached" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "nasa_planner_posts_publish_group_id_idx" ON "nasa_planner_posts"("publish_group_id");
