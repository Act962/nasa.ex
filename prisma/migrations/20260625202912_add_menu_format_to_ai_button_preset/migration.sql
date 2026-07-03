-- CreateEnum
CREATE TYPE "MenuFormat" AS ENUM ('BUTTON', 'LIST');

-- AlterTable
ALTER TABLE "ai_button_preset" ADD COLUMN     "list_button" TEXT,
ADD COLUMN     "menu_format" "MenuFormat" NOT NULL DEFAULT 'BUTTON';
