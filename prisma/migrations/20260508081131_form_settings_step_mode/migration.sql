-- AlterTable
ALTER TABLE "form_settings" ADD COLUMN     "next_button_label" TEXT NOT NULL DEFAULT 'Próximo',
ADD COLUMN     "step_mode" TEXT NOT NULL DEFAULT 'off';

