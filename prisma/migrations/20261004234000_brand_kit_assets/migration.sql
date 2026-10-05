-- Spec 0063: itens do Kit da Marca (fundos, produtos/serviços, materiais, posts de referência).
CREATE TYPE "BrandKitAssetKind" AS ENUM ('BACKGROUND', 'PRODUCT', 'MATERIAL', 'REFERENCE_POST');

CREATE TABLE "brand_kit_assets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "BrandKitAssetKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "file_key" TEXT,
    "url" TEXT,
    "price" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "brand_kit_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "brand_kit_assets_organization_id_kind_idx" ON "brand_kit_assets"("organization_id", "kind");

ALTER TABLE "brand_kit_assets" ADD CONSTRAINT "brand_kit_assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
