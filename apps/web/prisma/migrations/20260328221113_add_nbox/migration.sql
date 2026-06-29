-- CreateEnum
CREATE TYPE "NBoxItemType" AS ENUM ('FILE', 'IMAGE', 'LINK', 'CONTRACT', 'PROPOSAL');

-- CreateTable
CREATE TABLE "nbox_folders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "parent_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nbox_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nbox_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "type" "NBoxItemType" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "mime_type" TEXT,
    "size" INTEGER,
    "description" TEXT,
    "tags" TEXT[],
    "forge_contract_id" TEXT,
    "forge_proposal_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nbox_folders_organization_id_idx" ON "nbox_folders"("organization_id");

-- CreateIndex
CREATE INDEX "nbox_folders_parent_id_idx" ON "nbox_folders"("parent_id");

-- CreateIndex
CREATE INDEX "nbox_items_organization_id_idx" ON "nbox_items"("organization_id");

-- CreateIndex
CREATE INDEX "nbox_items_folder_id_idx" ON "nbox_items"("folder_id");

-- AddForeignKey
ALTER TABLE "nbox_folders" ADD CONSTRAINT "nbox_folders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nbox_folders" ADD CONSTRAINT "nbox_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "nbox_folders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nbox_folders" ADD CONSTRAINT "nbox_folders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nbox_items" ADD CONSTRAINT "nbox_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nbox_items" ADD CONSTRAINT "nbox_items_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "nbox_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nbox_items" ADD CONSTRAINT "nbox_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
