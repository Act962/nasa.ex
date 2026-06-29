-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_lead_id_fkey";

-- AlterTable
ALTER TABLE "tracking" ADD COLUMN     "global_ai_active" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
