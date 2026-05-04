-- CreateTable
CREATE TABLE "organization_insight_layout" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_insight_layout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_insight_layout_organization_id_key" ON "organization_insight_layout"("organization_id");

-- AddForeignKey
ALTER TABLE "organization_insight_layout" ADD CONSTRAINT "organization_insight_layout_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_insight_layout" ADD CONSTRAINT "organization_insight_layout_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
