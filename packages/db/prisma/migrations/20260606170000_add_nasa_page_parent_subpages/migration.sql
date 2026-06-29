-- Migration: NasaPage ganha self-relation pra multi-page sites.
--
-- Mudanças:
--   1. Adiciona colunas `parent_page_id` (FK self) e `subpage_order`.
--   2. Adiciona FK + ON DELETE CASCADE (apagar root apaga subpages).
--   3. Substitui o `slug @unique` global por DOIS partial unique indexes:
--      - Top-level (parent_page_id IS NULL): slug único globalmente
--        (mesmo comportamento de antes — não regride nada).
--      - Subpages (parent_page_id IS NOT NULL): slug único DENTRO do
--        mesmo parent — permite que 2 sites tenham subpage "sobre"
--        sem colidir.
--   4. Adiciona índice em (parent_page_id) pra agilizar lookup de
--      subpages por site.
--
-- Rows existentes ficam com parent_page_id = NULL, viram top-level
-- automaticamente. Comportamento da rota pública `/s/<slug>` segue
-- idêntico pros sites antigos (todos top-level).

-- 1. Colunas
ALTER TABLE "nasa_pages"
  ADD COLUMN "parent_page_id" TEXT,
  ADD COLUMN "subpage_order" INTEGER;

-- 2. FK self com cascade
ALTER TABLE "nasa_pages"
  ADD CONSTRAINT "nasa_pages_parent_page_id_fkey"
  FOREIGN KEY ("parent_page_id") REFERENCES "nasa_pages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Substitui slug @unique global por partial indexes
--    Drop do unique antigo (Prisma cria como "nasa_pages_slug_key").
DROP INDEX IF EXISTS "nasa_pages_slug_key";

--    Top-level: slug único globalmente quando parent é NULL.
CREATE UNIQUE INDEX "nasa_pages_top_level_slug_key"
  ON "nasa_pages"("slug")
  WHERE "parent_page_id" IS NULL;

--    Subpages: slug único por parent.
CREATE UNIQUE INDEX "nasa_pages_subpage_slug_key"
  ON "nasa_pages"("parent_page_id", "slug")
  WHERE "parent_page_id" IS NOT NULL;

-- 4. Índice em parent_page_id pra listSubpages rápido
CREATE INDEX "nasa_pages_parent_page_id_idx" ON "nasa_pages"("parent_page_id");
