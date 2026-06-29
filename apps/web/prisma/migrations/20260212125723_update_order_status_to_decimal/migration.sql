-- DropIndex
DROP INDEX "leads_status_id_created_at_idx";

-- DropIndex
DROP INDEX "leads_status_id_idx";

-- AlterTable
ALTER TABLE "status" ALTER COLUMN "order" DROP DEFAULT,
ALTER COLUMN "order" SET DATA TYPE DECIMAL(20,10);
