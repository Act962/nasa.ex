import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Detecta GRUPOS de tags duplicadas (mesmo nome dentro da org) e retorna
 * métricas (leads + automações ativas) por tag pra UI exibir um banner +
 * dialog de resolução manual.
 *
 * Por que NÃO auto-merge:
 *  - Tag com automações ativas: deletar quebra workflow em produção
 *  - Tag com leads vinculados: deletar perde anotações históricas
 *  - Caso ambas têm valor → operador escolhe sobrevivente conscientemente
 *
 * UI consumindo isso:
 *  - Banner "X duplicatas detectadas" no TagSheet
 *  - Dialog mostra cards lado-a-lado com metrics; user pica sobrevivente
 *  - Vítimas viram input pra `tag.mergeDuplicates`
 */
export const getDuplicateTags = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.void())
  .handler(async ({ context }) => {
    // Detecta duplicatas (mesmo nome + org, qualquer tracking_id, NÃO
    // arquivadas — arquivadas já estão fora do picker).
    const rows = await prisma.$queryRaw<
      Array<{
        name: string;
        tag_id: string;
        color: string | null;
        tracking_id: string | null;
        tracking_name: string | null;
        tag_group_id: string | null;
        tag_group_name: string | null;
        lead_count: bigint;
        automation_count: bigint;
        created_at: Date;
      }>
    >`
      -- Detecção case-insensitive + trim: "Empresa", " empresa ", "EMPRESA"
      -- são consideradas duplicatas. Casa com a agregação do Insights que
      -- usa name.trim().toLowerCase() pra colapsar barras do gráfico.
      WITH dup_keys AS (
        SELECT LOWER(TRIM(name)) AS name_key
        FROM tags
        WHERE organization_id = ${context.org.id}
          AND archived_at IS NULL
        GROUP BY LOWER(TRIM(name))
        HAVING COUNT(*) > 1
      )
      SELECT
        t.name,
        t.id AS tag_id,
        t.color,
        t.tracking_id,
        tr.name AS tracking_name,
        t.tag_group_id,
        tg.name AS tag_group_name,
        (SELECT COUNT(*) FROM lead_tags WHERE tag_id = t.id)::bigint AS lead_count,
        (
          SELECT COUNT(DISTINCT w.id)
          FROM nodes n
          JOIN workflows w ON w.id = n.workflow_id
          WHERE n.type IN ('TAG', 'LEAD_TAGGED')
            AND (
              (n.data::jsonb->>'tagId') = t.id
              OR (n.data::jsonb->'tagIds') ? t.id
            )
            AND w.is_active = true
        )::bigint AS automation_count,
        t.created_at
      FROM tags t
      LEFT JOIN tracking tr ON tr.id = t.tracking_id
      LEFT JOIN tag_groups tg ON tg.id = t.tag_group_id
      WHERE t.organization_id = ${context.org.id}
        AND t.archived_at IS NULL
        AND LOWER(TRIM(t.name)) IN (SELECT name_key FROM dup_keys)
      ORDER BY LOWER(TRIM(t.name)) ASC, t.created_at ASC
    `;

    // Agrupa por nome (chave normalizada lowercased trim) — cada entrada do
    // payload é um conjunto de duplicatas. O label exibido na UI é o nome
    // ORIGINAL da primeira tag no grupo (mantém capitalização que o user usou).
    const groups = new Map<
      string,
      {
        displayName: string;
        tags: Array<{
          id: string;
          color: string | null;
          trackingId: string | null;
          trackingName: string | null;
          tagGroupId: string | null;
          tagGroupName: string | null;
          leadCount: number;
          automationCount: number;
          createdAt: Date;
        }>;
      }
    >();

    for (const r of rows) {
      const key = r.name.trim().toLowerCase();
      let entry = groups.get(key);
      if (!entry) {
        entry = { displayName: r.name, tags: [] };
        groups.set(key, entry);
      }
      entry.tags.push({
        id: r.tag_id,
        color: r.color,
        trackingId: r.tracking_id,
        trackingName: r.tracking_name,
        tagGroupId: r.tag_group_id,
        tagGroupName: r.tag_group_name,
        leadCount: Number(r.lead_count),
        automationCount: Number(r.automation_count),
        createdAt: r.created_at,
      });
    }

    return {
      duplicates: Array.from(groups.values()).map((entry) => ({
        name: entry.displayName,
        tags: entry.tags,
      })),
      totalGroups: groups.size,
    };
  });
