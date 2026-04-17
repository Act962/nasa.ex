-- AlterTable
ALTER TABLE "star_transactions" ADD COLUMN     "user_id" TEXT;

-- CreateIndex
CREATE INDEX "star_transactions_organization_id_user_id_created_at_idx" ON "star_transactions"("organization_id", "user_id", "created_at");
