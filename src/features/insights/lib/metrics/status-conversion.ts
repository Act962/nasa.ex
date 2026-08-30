import "server-only";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * Conversão por status: dos leads criados no período (cohort), quantos
 * passaram por cada status do funil em qualquer momento. Fonte de verdade
 * única, consumida pela procedure `insights.getStatusConversion`.
 *
 * Diferença essencial pro `computeFunnel`: aquele conta o status ATUAL do
 * lead (contagens mutuamente exclusivas); aqui contamos status VISITADO, de
 * modo que um lead que passou por Exame → Consulta → Cirurgia conta nos três.
 * É o que a leitura "exames realizados" exige.
 *
 * O conjunto de status visitados por lead é a união de:
 *  - `Lead.statusId` — cobre o lead criado e nunca movido (sem evento algum);
 *  - `newStatusId`/`to` dos eventos `status_changed`;
 *  - `previousStatusId`/`from` dos mesmos eventos — é o que captura o status
 *    de criação, já que o lead só gera evento quando SAI dele.
 *
 * As duas convenções de chave no `metadata` existem em produção e ambas
 * precisam ser cobertas: `recordLeadEvent` grava `newStatusId`/`previousStatusId`,
 * enquanto o mover-em-massa (`leads/update-many-status.ts`) grava `to`/`from`.
 * Cobrir só uma faz movimentações em massa sumirem do relatório.
 */

export interface StatusConversionRow {
  statusId: string;
  name: string;
  color: string | null;
  /** Leads do cohort que passaram por este status em qualquer momento. */
  leadCount: number;
  /** 0–100 com uma casa decimal. 0 quando o cohort é vazio. */
  percentOfTotal: number;
}

export interface StatusConversionResult {
  tracking: { id: string; name: string };
  /**
   * Denominador: leads criados no período. Inclui ganhos, perdidos e
   * arquivados de propósito — é "leads recebidos", e manter a base fechada
   * faz o percentual de um mês passado não mudar depois.
   */
  totalLeads: number;
  /** Ordenado por `Status.order` ascendente. */
  statuses: StatusConversionRow[];
  /** Leads distintos que passaram por ao menos um dos status selecionados. */
  leadsInAnySelectedStatus: number;
  percentInAnySelectedStatus: number;
  /**
   * `false` quando nenhum número veio de evento de jornada — base anterior
   * ao registro de jornada. A UI avisa que os valores refletem só o status
   * atual, senão o usuário lê "5 cirurgias" e acha que houve perda de dados.
   */
  hasJourneyData: boolean;
}

export interface ComputeStatusConversionArgs {
  /** Orgs que podem ser donas do tracking (ownership check). */
  organizationIds: string[];
  trackingId: string;
  /** Vazio = todos os status do tracking. */
  statusIds?: string[];
  startDate?: Date;
  endDate?: Date;
  /** Recorta o cohort pelas mesmas tags do filtro do dashboard. */
  tagIds?: string[];
}

interface ConversionQueryRow {
  status_id: string | null;
  lead_count: bigint;
  has_event: boolean | null;
}

function toPercent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

/**
 * Retorna `null` quando o tracking não existe ou não pertence a nenhuma das
 * orgs informadas — o caller decide se vira NOT_FOUND ou mensagem amigável.
 */
export async function computeStatusConversion(
  args: ComputeStatusConversionArgs,
): Promise<StatusConversionResult | null> {
  const { organizationIds, trackingId, startDate, endDate, tagIds } = args;

  const tracking = await prisma.tracking.findFirst({
    where: { id: trackingId, organizationId: { in: organizationIds } },
    select: { id: true, name: true },
  });
  if (!tracking) return null;

  const trackingStatuses = await prisma.status.findMany({
    where: { trackingId },
    orderBy: { order: "asc" },
    select: { id: true, name: true, color: true },
  });

  // Intersecção descarta IDs órfãos (status deletado, seleção herdada de
  // outro tracking) e limita o array que vai como parâmetro na SQL.
  const selectedIds = args.statusIds ?? [];
  const resolvedStatuses =
    selectedIds.length > 0
      ? trackingStatuses.filter((status) => selectedIds.includes(status.id))
      : trackingStatuses;

  const dateFilter =
    startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {};

  const tagFilter =
    tagIds && tagIds.length > 0
      ? { leadTags: { some: { tagId: { in: tagIds } } } }
      : {};

  const totalLeads = await prisma.lead.count({
    where: { trackingId, ...dateFilter, ...tagFilter },
  });

  if (resolvedStatuses.length === 0) {
    return {
      tracking,
      totalLeads,
      statuses: [],
      leadsInAnySelectedStatus: 0,
      percentInAnySelectedStatus: 0,
      hasJourneyData: true,
    };
  }

  const resolvedStatusIds = resolvedStatuses.map((status) => status.id);

  // Agregação inteira no Postgres: só N+1 linhas voltam pro Node. Carregar os
  // eventos e agrupar em memória traria dezenas de milhares de blobs JSON, e
  // o Prisma Client não sabe projetar nem agrupar por `metadata->>'chave'`.
  const rows = await prisma.$queryRaw<ConversionQueryRow[]>`
    WITH cohort AS (
      SELECT l.id, l.status_id
      FROM leads l
      WHERE l.tracking_id = ${trackingId}
        ${startDate ? Prisma.sql`AND l.created_at >= ${startDate}` : Prisma.empty}
        ${endDate ? Prisma.sql`AND l.created_at <= ${endDate}` : Prisma.empty}
        ${
          tagIds && tagIds.length > 0
            ? Prisma.sql`AND EXISTS (
                SELECT 1 FROM lead_tags lt
                WHERE lt.lead_id = l.id AND lt.tag_id = ANY(${tagIds}::text[])
              )`
            : Prisma.empty
        }
    ),
    visited AS (
      SELECT c.id AS lead_id, c.status_id, false AS from_event
      FROM cohort c
      UNION ALL
      SELECT e.lead_id, v.status_id, true
      FROM lead_journey_events e
      JOIN cohort c ON c.id = e.lead_id
      CROSS JOIN LATERAL (VALUES
        (e.metadata->>'newStatusId'),
        (e.metadata->>'previousStatusId'),
        (e.metadata->>'to'),
        (e.metadata->>'from')
      ) AS v(status_id)
      WHERE e.kind = 'status_changed' AND v.status_id IS NOT NULL
    )
    SELECT
      status_id,
      COUNT(DISTINCT lead_id)::bigint AS lead_count,
      bool_or(from_event) AS has_event
    FROM visited
    WHERE status_id = ANY(${resolvedStatusIds}::text[])
    GROUP BY GROUPING SETS ((status_id), ())
  `;

  // A linha com `status_id NULL` é o agregado do GROUPING SETS: leads
  // distintos que passaram por ao menos um dos status selecionados.
  const aggregateRow = rows.find((row) => row.status_id === null);
  const countByStatus = new Map(
    rows
      .filter((row) => row.status_id !== null)
      .map((row) => [row.status_id as string, Number(row.lead_count)]),
  );

  const statuses: StatusConversionRow[] = resolvedStatuses.map((status) => {
    const leadCount = countByStatus.get(status.id) ?? 0;
    return {
      statusId: status.id,
      name: status.name,
      color: status.color,
      leadCount,
      percentOfTotal: toPercent(leadCount, totalLeads),
    };
  });

  const leadsInAnySelectedStatus = aggregateRow
    ? Number(aggregateRow.lead_count)
    : 0;

  return {
    tracking,
    totalLeads,
    statuses,
    leadsInAnySelectedStatus,
    percentInAnySelectedStatus: toPercent(leadsInAnySelectedStatus, totalLeads),
    hasJourneyData: aggregateRow?.has_event ?? false,
  };
}
