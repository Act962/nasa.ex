-- AlterTable
ALTER TABLE "tracking" ADD COLUMN     "kanban_background_blur" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kanban_background_color" TEXT,
ADD COLUMN     "kanban_background_image" TEXT,
ADD COLUMN     "kanban_background_opacity" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "kanban_card_background_color" TEXT,
ADD COLUMN     "kanban_card_border_color" TEXT,
ADD COLUMN     "kanban_column_background_color" TEXT,
ADD COLUMN     "kanban_column_border_color" TEXT;
