-- AlterTable
ALTER TABLE "form_settings" ADD COLUMN     "next_button_action" JSONB NOT NULL DEFAULT '{"type":"next_block"}';
