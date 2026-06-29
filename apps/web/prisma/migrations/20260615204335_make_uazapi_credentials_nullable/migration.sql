-- AlterTable
ALTER TABLE "whatsapp_instances" ALTER COLUMN "instance_id" DROP NOT NULL,
ALTER COLUMN "api_key" DROP NOT NULL,
ALTER COLUMN "base_url" DROP NOT NULL;
