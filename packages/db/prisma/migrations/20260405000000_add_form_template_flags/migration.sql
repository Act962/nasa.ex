-- AlterTable
ALTER TABLE "forms" ADD COLUMN "is_template" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "forms" ADD COLUMN "template_marked_by_moderator" BOOLEAN NOT NULL DEFAULT false;
