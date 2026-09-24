import { DEFAULT_RESCUE_CONFIG } from "@/lib/lead-journey/sla";

/**
 * As réguas dos segmentos de /contatos, em um lugar só.
 *
 * Os cards e a tabela precisam concordar: se a contagem e a lista usarem
 * regras diferentes, o usuário clica em "Risco: 3" e vê outra coisa — e
 * passa a não confiar em nenhum dos dois números.
 */

export const NEW_LEAD_DAYS = 30;
export const LOYAL_MESSAGE_COUNT = 10;
export const RISK_DAYS = DEFAULT_RESCUE_CONFIG.stuckDays;

export type LeadSegment = "novos" | "campeoes" | "leais" | "risco";

export interface SegmentFilters {
  trackingId?: string;
  tagIds?: string[];
  dateField?: "createdAt" | "lastInboundAt";
  from?: string;
  to?: string;
  segment?: LeadSegment;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60_000);
}

/** Recorte comum: tracking, tags e período. Não inclui o segmento. */
export function buildScopeWhere(filters?: SegmentFilters) {
  const dateField = filters?.dateField ?? "createdAt";
  const from = filters?.from ? new Date(filters.from) : undefined;
  const to = filters?.to ? new Date(filters.to) : undefined;

  return {
    ...(filters?.trackingId ? { trackingId: filters.trackingId } : {}),
    ...(filters?.tagIds && filters.tagIds.length > 0
      ? { tags: { some: { tagId: { in: filters.tagIds } } } }
      : {}),
    ...(from || to
      ? {
          [dateField]: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    isArchived: false,
  };
}

/** A regra de UM segmento, sem o recorte. */
export function segmentWhere(segment: LeadSegment) {
  switch (segment) {
    case "novos":
      return { currentAction: "ACTIVE" as const, createdAt: { gte: daysAgo(NEW_LEAD_DAYS) } };
    case "campeoes":
      return { currentAction: "WON" as const };
    case "leais":
      // Recorte grosso: quem tem conversa. O corte por volume não cabe em
      // `where` do Prisma e é aplicado por `resolveSegmentWhere`.
      return { conversation: { messages: { some: {} } } };
    case "risco":
      return {
        currentAction: "ACTIVE" as const,
        OR: [
          { lastInboundAt: { lt: daysAgo(RISK_DAYS) } },
          { lastInboundAt: null, createdAt: { lt: daysAgo(RISK_DAYS) } },
        ],
      };
  }
}

export function buildSegmentWhere(filters?: SegmentFilters) {
  return {
    ...buildScopeWhere(filters),
    ...(filters?.segment ? segmentWhere(filters.segment) : {}),
  };
}

const MAX_LOYAL_SCAN = 2000;

/**
 * "Leal" exige contar mensagens, e `where` do Prisma não compara contagem de
 * relação. Resolver aqui — e nos DOIS lados — é o que impede o card dizer 3
 * e a lista mostrar 40.
 */
export async function loyalLeadIds(
  prisma: { lead: { findMany: (args: unknown) => Promise<unknown> } },
  where: Record<string, unknown>,
): Promise<string[]> {
  const rows = (await prisma.lead.findMany({
    where: { ...where, ...segmentWhere("leais") },
    select: {
      id: true,
      conversation: { select: { _count: { select: { messages: true } } } },
    },
    take: MAX_LOYAL_SCAN,
  })) as Array<{
    id: string;
    conversation: { _count: { messages: number } } | null;
  }>;

  return rows
    .filter((lead) => (lead.conversation?._count.messages ?? 0) >= LOYAL_MESSAGE_COUNT)
    .map((lead) => lead.id);
}
