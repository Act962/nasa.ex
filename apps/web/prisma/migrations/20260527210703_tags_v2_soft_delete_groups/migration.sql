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

-- ─── 3. Merge DEFENSIVO de duplicatas (PRE-PROMOÇÃO ORG-WIDE) ────────────────
--
-- REGRA INTELIGENTE: só auto-merge quando há CLARO VENCEDOR.
--
-- Considera o "valor" de cada tag = COUNT(lead_tags) + 10*COUNT(automations).
-- Automações pesam mais que leads porque deletar uma tag de automação quebra
-- workflow ativo; deletar tag com leads só perde anotações históricas (e
-- ainda assim é preservado em LeadJourneyEvent.metadata.tagName).
--
-- Cenários:
--  - Vencedor claro (uma tag tem todo o "valor", outra tem 0): merge auto
--  - Empate ou ambas têm valor: SKIP (gera NOTICE no log). User resolve
--    manualmente via UI `tag.getDuplicates` → `tag.mergeDuplicates`.
--
-- Idempotente: re-runs detectam só os casos com vencedor claro que sobraram.

DO $$
DECLARE
  dup_record RECORD;
  survivor_id TEXT;
  victims TEXT[];
  victim_id TEXT;
  ambiguous_count INTEGER := 0;
  merged_count INTEGER := 0;
BEGIN
  FOR dup_record IN (
    -- Agrupa por (name, org) tags que TÊM tracking_id setado (pré-promoção).
    -- Inclui também tags org-wide existentes com mesmo nome (cenário misto)
    -- pra ser exaustivo.
    SELECT
      t.name,
      t.organization_id,
      ARRAY_AGG(
        json_build_object(
          'id', t.id,
          'leads', (SELECT COUNT(*) FROM lead_tags WHERE tag_id = t.id),
          'automations', (
            SELECT COUNT(DISTINCT w.id) FROM nodes n
            JOIN workflows w ON w.id = n.workflow_id
            WHERE n.type IN ('TAG', 'LEAD_TAGGED')
              AND (
                (n.data::jsonb->>'tagId') = t.id
                OR (n.data::jsonb->'tagIds') ? t.id
              )
              AND w.is_active = true
          ),
          'created_at', t.created_at
        )::text
      ) AS tags_info
    FROM tags t
    GROUP BY t.name, t.organization_id
    HAVING COUNT(*) > 1
  )
  LOOP
    -- Parse: descobre quem tem "valor" (leads + automações)
    -- Sobrevivente preferido: maior valor; empate → mais antiga
    -- Vítimas: candidatos com 0 leads E 0 automações
    SELECT (parsed->>'id')::text INTO survivor_id
    FROM (
      SELECT (jsonb_array_elements(to_jsonb(dup_record.tags_info)::jsonb)::text::jsonb) AS parsed
    ) sub
    ORDER BY
      ((parsed->>'leads')::int + 10 * (parsed->>'automations')::int) DESC,
      (parsed->>'created_at')::timestamp ASC
    LIMIT 1;

    -- Vítimas: outras tags do grupo que têm 0 valor (deletáveis sem risco)
    SELECT ARRAY_AGG((parsed->>'id')::text) INTO victims
    FROM (
      SELECT (jsonb_array_elements(to_jsonb(dup_record.tags_info)::jsonb)::text::jsonb) AS parsed
    ) sub
    WHERE (parsed->>'id')::text != survivor_id
      AND (parsed->>'leads')::int = 0
      AND (parsed->>'automations')::int = 0;

    -- Se todas as não-sobreviventes têm 0 valor → merge seguro
    -- Se alguma tiver valor → SKIP e loga (user resolve manualmente)
    IF victims IS NULL OR array_length(victims, 1) IS NULL THEN
      ambiguous_count := ambiguous_count + 1;
      RAISE NOTICE 'Tag "%" em org % tem duplicatas com valor (leads/automações). Pulando merge automático — resolver via UI.', dup_record.name, dup_record.organization_id;
      CONTINUE;
    END IF;

    -- Conta quantas duplicatas FORAM contadas — se < (total - 1), há outras
    -- com valor que também não devem ser deletadas. Skip nesse caso também.
    DECLARE
      total_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO total_count FROM tags
        WHERE name = dup_record.name AND organization_id = dup_record.organization_id;
      IF array_length(victims, 1) < total_count - 1 THEN
        ambiguous_count := ambiguous_count + 1;
        RAISE NOTICE 'Tag "%" tem múltiplas duplicatas com valor. Pulando — resolver via UI.', dup_record.name;
        CONTINUE;
      END IF;
    END;

    -- Merge SEGURO: vítimas têm 0 leads/0 automações. Não precisa redirecionar
    -- lead_tags nem atualizar node.data (não há referências). Só deleta.
    DELETE FROM tags WHERE id = ANY(victims);
    merged_count := merged_count + array_length(victims, 1);
  END LOOP;

  RAISE NOTICE 'Tags V2 migration: % merge(s) automático(s), % conjunto(s) ambíguo(s) (resolver via UI).', merged_count, ambiguous_count;
END $$;

-- ─── 4. PROMOÇÃO ORG-WIDE ────────────────────────────────────────────────────
-- Promove só as que NÃO tinham conflito (ambíguas permanecem tracking-scoped
-- até user resolver manualmente via UI). Filtro: só promove se NÃO existe
-- outra tag com mesmo name+org já org-wide.
UPDATE tags SET tracking_id = NULL
WHERE tracking_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tags t2
    WHERE t2.name = tags.name
      AND t2.organization_id = tags.organization_id
      AND t2.id != tags.id
  );
