
-- AlterTable
ALTER TABLE "payment_dunning_steps" ADD COLUMN     "whatsapp_template_language" TEXT,
ADD COLUMN     "whatsapp_template_name" TEXT,
ADD COLUMN     "whatsapp_template_params" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "payment_entries" ADD COLUMN     "dunning_paused_until" TIMESTAMP(3);

