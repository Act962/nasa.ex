-- ════════════════════════════════════════════════════════════════════════════
-- TAGS 2.0 — soft-delete + grupos + promoção org-wide
-- ════════════════════════════════════════════════════════════════════════════
-- Aditivo + 1 step destrutivo de migração de dados (UPDATE tracking_id=NULL).
-- Idempotente (IF NOT EXISTS) + tolerante a duplicatas (merge antes do UPDATE).
--
-- Ordem importa:
--   1. CREATE tag_groups + colunas em tag (aditivo)
--   2. Detectar + mergear duplicatas (mesma name+org em trackings distintos)
--   3. UPDATE tag.tracking_id = NULL (promoção org-wide)
--   4. Índices

-- ─── 1. Novo model TagGroup ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "tag_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT,
    "organization_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tag_groups_name_organization_id_key"
  ON "tag_groups"("name", "organization_id");
CREATE INDEX IF NOT EXISTS "tag_groups_organization_id_order_idx"
  ON "tag_groups"("organization_id", "order");

DO $$ BEGIN
  ALTER TABLE "tag_groups" ADD CONSTRAINT "tag_groups_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. Adicionar colunas em Tag (soft-delete + grupo) ───────────────────────
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "archived_by_id" TEXT;
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "tag_group_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "tags" ADD CONSTRAINT "tags_archived_by_id_fkey"
    FOREIGN KEY ("archived_by_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tags" ADD CONSTRAINT "tags_tag_group_id_fkey"
    FOREIGN KEY ("tag_group_id") REFERENCES "tag_groups"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "tags_organization_id_archived_at_idx"
  ON "tags"("organization_id", "archived_at");
CREATE INDEX IF NOT EXISTS "tags_tag_group_id_idx"
  ON "tags"("tag_group_id");

-- ─── 3. Merge de duplicatas (PRE-PROMOÇÃO ORG-WIDE) ──────────────────────────
-- Por que: a unique constraint (name, organization_id, tracking_id) tolera
-- "VIP" em Tracking A E Tracking B porque tracking_id diferente. Quando
-- promovermos ambos pra tracking_id=NULL, viola constraint.
--
-- Estratégia: pega a tag mais antiga (MIN(created_at)) como SOBREVIVENTE.
-- Atualiza lead_tags pra apontar pra ela. Atualiza node.data JSON nos
-- workflows. Deleta as duplicatas.
--
-- Idempotência: a CTE só encontra duplicatas; se rodar 2x, na 2ª já não acha
-- nada (porque as duplicadas foram apagadas) — é safe.

WITH duplicates AS (
  SELECT
    name,
    organization_id,
    -- Sobrevivente: a tag mais antiga (criada primeiro)
    (SELECT id FROM tags t2
      WHERE t2.name = t1.name
        AND t2.organization_id = t1.organization_id
      ORDER BY t2.created_at ASC, t2.id ASC
      LIMIT 1) AS survivor_id,
    -- Lista de IDs duplicadas (excluindo o sobrevivente)
    ARRAY_AGG(t1.id) FILTER (
      WHERE t1.id != (
        SELECT id FROM tags t2
          WHERE t2.name = t1.name
            AND t2.organization_id = t1.organization_id
          ORDER BY t2.created_at ASC, t2.id ASC
          LIMIT 1
      )
    ) AS duplicate_ids
  FROM tags t1
  WHERE tracking_id IS NOT NULL
  GROUP BY name, organization_id
  HAVING COUNT(*) > 1
)
UPDATE lead_tags lt
SET tag_id = d.survivor_id
FROM duplicates d
WHERE lt.tag_id = ANY(d.duplicate_ids);

-- Atualiza node.data JSON em workflows (TAG action + LEAD_TAGGED trigger)
-- Substitui referências às tags duplicadas pelo sobrevivente.
-- Lida com 2 shapes: data->'tagId' (single) ou data->'tagIds' (array).
DO $$
DECLARE
  dup_record RECORD;
BEGIN
  FOR dup_record IN (
    SELECT
      (SELECT id FROM tags t2
        WHERE t2.name = t1.name AND t2.organization_id = t1.organization_id
        ORDER BY t2.created_at ASC LIMIT 1) AS survivor_id,
      ARRAY_AGG(t1.id) FILTER (WHERE t1.id != (
        SELECT id FROM tags t3
          WHERE t3.name = t1.name AND t3.organization_id = t1.organization_id
          ORDER BY t3.created_at ASC LIMIT 1
      )) AS duplicate_ids
    FROM tags t1
    WHERE tracking_id IS NOT NULL
    GROUP BY name, organization_id
    HAVING COUNT(*) > 1
  )
  LOOP
    -- Single tagId
    UPDATE nodes n
    SET data = jsonb_set(n.data::jsonb, '{tagId}', to_jsonb(dup_record.survivor_id))
    WHERE n.type IN ('TAG', 'LEAD_TAGGED')
      AND (n.data::jsonb->>'tagId') = ANY(dup_record.duplicate_ids);

    -- Array tagIds — remove dups + adiciona survivor (sem duplicar)
    UPDATE nodes n
    SET data = jsonb_set(
      n.data::jsonb,
      '{tagIds}',
      (
        SELECT to_jsonb(ARRAY_AGG(DISTINCT elem))
        FROM (
          SELECT jsonb_array_elements_text(n.data::jsonb->'tagIds') AS elem
        ) sub
        WHERE elem != ALL(dup_record.duplicate_ids)
        UNION
        SELECT dup_record.survivor_id
      )
    )
    WHERE n.type IN ('TAG', 'LEAD_TAGGED')
      AND n.data::jsonb ? 'tagIds'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(n.data::jsonb->'tagIds') AS e
        WHERE e = ANY(dup_record.duplicate_ids)
      );
  END LOOP;
END $$;

-- Deleta as tags duplicadas (sobreviveram só as mais antigas)
DELETE FROM tags
WHERE id IN (
  SELECT t1.id FROM tags t1
  WHERE tracking_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM tags t2
      WHERE t2.name = t1.name
        AND t2.organization_id = t1.organization_id
        AND t2.id != t1.id
        AND t2.created_at < t1.created_at
    )
);

-- ─── 4. PROMOÇÃO ORG-WIDE ────────────────────────────────────────────────────
-- Agora seguro: sem duplicatas restantes, promove tudo pra org-wide.
UPDATE tags SET tracking_id = NULL WHERE tracking_id IS NOT NULL;
