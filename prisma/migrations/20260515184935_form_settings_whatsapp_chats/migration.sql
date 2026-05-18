-- AlterTable
ALTER TABLE "form_settings" ADD COLUMN     "whatsapp_chats" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "whatsapp_message" TEXT;
