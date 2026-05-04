-- CreateTable
CREATE TABLE "sub_action_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "action_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sub_action_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sub_action_groups_action_id_idx" ON "sub_action_groups"("action_id");

-- AddForeignKey
ALTER TABLE "sub_action_groups" ADD CONSTRAINT "sub_action_groups_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "sub_action" ADD COLUMN     "group_id" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill order based on creation order per action
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY action_id ORDER BY created_at ASC, id ASC) - 1 AS rn
  FROM "sub_action"
)
UPDATE "sub_action" s SET "order" = r.rn FROM ranked r WHERE s.id = r.id;

-- CreateIndex
CREATE INDEX "sub_action_group_id_idx" ON "sub_action"("group_id");

-- AddForeignKey
ALTER TABLE "sub_action" ADD CONSTRAINT "sub_action_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "sub_action_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
