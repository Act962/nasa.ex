/*
  Warnings:

  - You are about to drop the column `org_id` on the `space_point_rule` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[action]` on the table `space_point_rule` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id]` on the table `user_space_point` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "space_point_rule" DROP CONSTRAINT "space_point_rule_org_id_fkey";

-- DropIndex
DROP INDEX "space_point_rule_org_id_action_key";

-- DropIndex
DROP INDEX "space_point_rule_org_id_idx";

-- DropIndex
DROP INDEX "user_space_point_org_id_total_points_idx";

-- DropIndex
DROP INDEX "user_space_point_user_id_org_id_key";

-- AlterTable
ALTER TABLE "space_point_rule" DROP COLUMN "org_id";

-- AlterTable
ALTER TABLE "space_point_transaction" ADD COLUMN     "org_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "space_point_rule_action_key" ON "space_point_rule"("action");

-- CreateIndex
CREATE INDEX "space_point_transaction_org_id_idx" ON "space_point_transaction"("org_id");

-- CreateIndex
CREATE INDEX "space_point_transaction_org_id_created_at_idx" ON "space_point_transaction"("org_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_space_point_user_id_key" ON "user_space_point"("user_id");

-- AddForeignKey
ALTER TABLE "space_point_transaction" ADD CONSTRAINT "space_point_transaction_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
