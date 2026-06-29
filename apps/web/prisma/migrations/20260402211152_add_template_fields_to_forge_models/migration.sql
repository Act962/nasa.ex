-- AlterTable
ALTER TABLE "forge_proposals" ADD COLUMN "is_template" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "template_marked_by_moderator" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "forge_contracts" ADD COLUMN "is_template" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "template_marked_by_moderator" BOOLEAN NOT NULL DEFAULT false;
