-- AlterTable
ALTER TABLE "payment_dunning_executions" ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "read_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "payment_dunning_executions_message_id_idx" ON "payment_dunning_executions"("message_id");
