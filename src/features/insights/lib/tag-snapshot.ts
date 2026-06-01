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

  // Sem endDate (ou no futuro) → snapshot = estado atual (LeadTag vivos).
  //
  // Compara contra `now` (instante exato), não start-of-today. Calendar
  // do front manda `endOf("day")` em America/Sao_Paulo:
  //  - Filtrar HOJE → endDate=HOJE 23:59 BRT > now (14:00 BRT) → null → live ✓
  //  - Filtrar ONTEM → endDate=ONTEM 23:59 BRT < now → cutoff → histórico ✓
  //
  // Comparar com start-of-today quebrava o caso ONTEM em servidor UTC:
  // endDate 28.05 02:59 UTC > todayStart 28.05 00:00 UTC → caía no live e
  // mostrava estado ATUAL pra filtro de ontem (Clark Kent saía retroativo).
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

  // Snapshot histórico via $queryRaw com 4 fontes UNION:
  //
  //  1. tag_added reais (journey events) com occurred_at <= cutoff
  //  2. tag_removed reais com occurred_at <= cutoff
  //  3. LeadTag.createdAt fallback (lead AINDA tem a tag e createdAt <= cutoff)
  //  4. **Synthetic add inferido** (occurred_at = 1970): pra cada tag_removed
  //     FUTURO (occurred_at > cutoff) que NÃO tem tag_added anterior,
  //     infere que a tag estava ativa antes do remove. Cobre cenário
  //     comum: lead tagueado via webhook/importação/AI/forms (caminhos
  //     que NÃO disparam recordLeadEvent ainda) e depois tag removida.
  //
  // ROW_NUMBER por (lead, tag) ORDER BY event_at DESC pega o último estado.
  // Synthetic add em 1970 só vence quando não há outro evento — exatamente
  // o que queremos: tag estava ativa "desde sempre" até alguém remover.
  const rows = await prisma.$queryRaw<
    Array<{ lead_id: string; tag_id: string }>
  >`
    WITH all_events AS (
      -- 1. Tag adições reais
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

      -- 2. Tag remoções reais
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

      -- 3. Fallback LeadTag.createdAt (tag ainda viva, criada antes do cutoff)
      SELECT
        lead_id,
        tag_id,
        'add',
        created_at
      FROM lead_tags
      WHERE created_at <= ${cutoff}
        AND lead_id = ANY(${leadIds}::text[])

      UNION ALL

      -- 4. SYNTHETIC ADD inferido pra leads tagueados sem journey event.
      -- Se há tag_removed FUTURO (após cutoff) sem tag_added anterior na
      -- história inteira, a tag DEVE ter estado ativa antes da remoção.
      -- Cobre Clark Kent: tagueado via webhook (sem add event), removido
      -- HOJE — snapshot de ONTEM ainda mostra ele.
      SELECT
        r.lead_id,
        (r.metadata->>'tagId'),
        'add',
        TIMESTAMP '1970-01-01 00:00:00'
      FROM lead_journey_events r
      WHERE r.kind = 'tag_removed'
        AND r.metadata->>'tagId' IS NOT NULL
        AND r.occurred_at > ${cutoff}
        AND r.lead_id = ANY(${leadIds}::text[])
        AND NOT EXISTS (
          SELECT 1 FROM lead_journey_events a
          WHERE a.kind = 'tag_added'
            AND a.lead_id = r.lead_id
            AND a.metadata->>'tagId' = r.metadata->>'tagId'
            AND a.occurred_at < r.occurred_at
        )
    ),
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
