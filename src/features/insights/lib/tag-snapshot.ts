import prisma from "@/lib/prisma";

/**
 * Reconstrói o snapshot temporal de quais tags cada lead tinha em uma
 * data específica (endDate), independente do estado ATUAL no banco.
 *
 * **Por que existe:** o Insights antigo contava `LeadTag` rows VIVOS —
 * quando o operador removia uma tag HOJE, a métrica de ONTEM caía
 * retroativamente (a tag desaparecia do histórico do gráfico).
 *
 * **Algoritmo:**
 * Pra cada par (leadId, tagId), olha a ÚLTIMA operação relevante com
 * `occurredAt <= endDate`:
 *  - Se `tag_added` → lead tinha a tag em endDate
 *  - Se `tag_removed` → lead NÃO tinha a tag em endDate
 *  - Sem evento + LeadTag.createdAt <= endDate → lead tinha (fallback
 *    pra dados anteriores ao sistema de journey events)
 *
 * Fontes:
 *  - `LeadJourneyEvent.kind IN ('tag_added','tag_removed')` com
 *    `metadata.tagId` capturado no momento da operação
 *  - `LeadTag.createdAt` como fallback histórico
 *
 * Retorna apenas os pares (lead, tag) que estavam ATIVOS no endDate.
 *
 * Performance: 1 query agregada com CTEs e ROW_NUMBER. O(N events +
 * M leadTags) por chamada. Bom até dezenas de milhares de eventos —
 * acima disso, considerar materializar uma view.
 */
export async function getTagSnapshotAtDate(
  leadIds: string[],
  endDate: Date | null,
): Promise<Array<{ leadId: string; tagId: string }>> {
  if (leadIds.length === 0) return [];

  // Sem endDate (ou no futuro) → snapshot = estado atual (LeadTag vivos)
  const now = new Date();
  const cutoff = endDate && endDate < now ? endDate : null;

  if (!cutoff) {
    // Caminho rápido: estado atual
    const rows = await prisma.leadTag.findMany({
      where: { leadId: { in: leadIds } },
      select: { leadId: true, tagId: true },
    });
    return rows;
  }

  // Snapshot histórico via $queryRaw (operadores JSON do Postgres)
  const rows = await prisma.$queryRaw<
    Array<{ lead_id: string; tag_id: string }>
  >`
    WITH all_events AS (
      -- Tag adições do journey (com tagId no metadata)
      SELECT
        lead_id,
        (metadata->>'tagId') AS tag_id,
        'add' AS op,
        occurred_at AS event_at
      FROM lead_journey_events
      WHERE kind = 'tag_added'
        AND metadata->>'tagId' IS NOT NULL
        AND occurred_at <= ${cutoff}
        AND lead_id = ANY(${leadIds}::text[])

      UNION ALL

      -- Tag remoções (mesma estrutura)
      SELECT
        lead_id,
        (metadata->>'tagId'),
        'remove',
        occurred_at
      FROM lead_journey_events
      WHERE kind = 'tag_removed'
        AND metadata->>'tagId' IS NOT NULL
        AND occurred_at <= ${cutoff}
        AND lead_id = ANY(${leadIds}::text[])

      UNION ALL

      -- Fallback: LeadTag atuais cujo created_at <= cutoff. Cobre tags
      -- adicionadas ANTES do sistema de journey events ter sido criado
      -- (sem essa, snapshot de dados antigos ficaria zerado).
      SELECT
        lead_id,
        tag_id,
        'add',
        created_at
      FROM lead_tags
      WHERE created_at <= ${cutoff}
        AND lead_id = ANY(${leadIds}::text[])
    ),
    -- Pra cada par (lead, tag), a operação MAIS RECENTE até cutoff vence.
    last_per_pair AS (
      SELECT
        lead_id,
        tag_id,
        op,
        ROW_NUMBER() OVER (
          PARTITION BY lead_id, tag_id
          ORDER BY event_at DESC
        ) AS rn
      FROM all_events
    )
    SELECT lead_id, tag_id
    FROM last_per_pair
    WHERE rn = 1 AND op = 'add'
  `;

  return rows.map((r) => ({ leadId: r.lead_id, tagId: r.tag_id }));
}
