-- AlterTable
ALTER TABLE "tracking" ADD COLUMN     "kanban_card_background_opacity" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "kanban_column_background_opacity" INTEGER NOT NULL DEFAULT 100;
