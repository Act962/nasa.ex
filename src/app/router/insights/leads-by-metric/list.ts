import { z } from "zod";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

const APP = z.enum(["lead", "forge", "spacetime", "chat"]);

const METRIC = z.enum([
  // Lead direto (Visão Geral > Tracking > Leads & Pipeline)
  "lead.total",
  "lead.active",
  "lead.won",
  "lead.lost",
  // Lead filtrado por extras (Funil, Origem)
  "lead.byStatus",
  "lead.bySource",
  "lead.byUtmCampaign",
  "lead.byUtmSource",
  // Forge → ForgeProposal.client (Lead)
  "forge.rascunho",
  "forge.enviadas",
  "forge.visualizadas",
  "forge.pagas",
  "forge.expiradas",
  "forge.canceladas",
  "forge.totalProposals",
  // SpaceTime → Appointment.lead
  "spacetime.total",
  "spacetime.pending",
  "spacetime.confirmed",
  "spacetime.done",
  "spacetime.cancelled",
  "spacetime.noShow",
  "spacetime.withLead",
  // Chat → Conversation.lead
  "chat.totalConversations",
  "chat.attendedConversations",
  "chat.unattendedConversations",
]);

const InputSchema = z.object({
  app: APP,
  metric: METRIC,
  organizationIds: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  trackingId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  // Filtros extras pra métricas parametrizadas (lead.byStatus etc).
  statusId: z.string().optional(),
  source: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmSource: z.string().optional(),
  limit: z.number().int().positive().max(50).optional().default(10),
  cursor: z.string().optional(),
});

const LEAD_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  source: true,
  responsible: { select: { id: true, name: true, image: true } },
  status: { select: { id: true, name: true, color: true } },
  tracking: { select: { id: true, name: true, organizationId: true } },
} as const;

type LeadRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  responsible: { id: string; name: string; image: string | null } | null;
  status: { id: string; name: string; color: string | null } | null;
  tracking: { id: string; name: string; organizationId: string } | null;
  metricLabel?: string | null;
  metricAt?: Date | null;
};

/**
 * Lista os leads vinculados a uma métrica específica de um app no
 * dashboard de Insights. Espelha exatamente os filtros usados em
 * `getAppsInsights` pra contar os cards — assim o número do card SEMPRE
 * bate com o total retornado aqui.
 *
 * Apps suportados: Forge (Proposal.client), SpaceTime (Appointment.lead),
 * Chat (Conversation.lead). Payment e NASA Route não têm linkage direto
 * com Lead no schema.
 */
export const listLeadsByAppMetric = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/insights/leads-by-app-metric",
    summary:
      "Lista leads vinculados a uma métrica específica de um app (Forge/SpaceTime/Chat)",
  })
  .input(InputSchema)
  .handler(async ({ input, context }) => {
    const { org } = context;
    const orgIds =
      input.organizationIds && input.organizationIds.length > 0
        ? input.organizationIds
        : [org.id];

    const dateRange =
      input.startDate && input.endDate
        ? { gte: new Date(input.startDate), lte: new Date(input.endDate) }
        : undefined;

    // Mesmo filtro de tag usado no getAppsInsights — Lead com pelo menos
    // uma tag em input.tagIds. Quando vazio, sem filtro.
    const tagWhereLead =
      input.tagIds && input.tagIds.length > 0
        ? { leadTags: { some: { tagId: { in: input.tagIds } } } }
        : undefined;

    const ctx = {
      orgIds,
      dateRange,
      trackingId: input.trackingId,
      tagWhereLead,
      statusId: input.statusId,
      source: input.source,
      utmCampaign: input.utmCampaign,
      utmSource: input.utmSource,
      limit: input.limit + 1,
      cursor: input.cursor,
    };

    if (input.app === "lead") return await fetchLead({ metric: input.metric, ...ctx });
    if (input.app === "forge") return await fetchForge({ metric: input.metric, ...ctx });
    if (input.app === "spacetime") return await fetchSpacetime({ metric: input.metric, ...ctx });
    if (input.app === "chat") return await fetchChat({ metric: input.metric, ...ctx });

    return { leads: [] as LeadRow[], nextCursor: null as string | null, total: 0 };
  });

// ─── Lead direto ────────────────────────────────────────────────────────

async function fetchLead({
  metric,
  orgIds,
  dateRange,
  trackingId,
  tagWhereLead,
  statusId,
  source,
  utmCampaign,
  utmSource,
  limit,
  cursor,
}: FetchCtx) {
  // Espelha exatamente o baseWhere de getTrackingDashboardReport (que
  // alimenta o card "Total de Leads", "Leads Ativos", etc.). Aqui
  // simplificamos: não verificamos members.some — assumimos que o usuário
  // logado já passou pelo requireOrgMiddleware.
  const actionMap: Record<string, "WON" | "LOST" | "ACTIVE" | undefined> = {
    "lead.total": undefined,
    "lead.active": "ACTIVE",
    "lead.won": "WON",
    "lead.lost": "LOST",
    "lead.byStatus": "ACTIVE", // Funil mostra leads ativos por etapa
    "lead.bySource": undefined,
    "lead.byUtmCampaign": undefined,
    "lead.byUtmSource": undefined,
  };
  const action = actionMap[metric];

  const where = {
    tracking: { organizationId: { in: orgIds } },
    ...(trackingId ? { trackingId } : {}),
    ...(dateRange ? { createdAt: dateRange } : {}),
    ...(action ? { currentAction: action } : {}),
    ...(tagWhereLead ?? {}),
    ...(metric === "lead.byStatus" && statusId ? { statusId } : {}),
    ...(metric === "lead.bySource" && source ? { source: source as "DEFAULT" } : {}),
    ...(metric === "lead.byUtmCampaign" && utmCampaign ? { utmCampaign } : {}),
    ...(metric === "lead.byUtmSource" && utmSource ? { utmSource } : {}),
  } as Prisma.LeadWhereInput;

  const total = await prisma.lead.count({ where });

  const leadsRaw = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { ...LEAD_SELECT, createdAt: true },
  });

  const leads: LeadRow[] = leadsRaw.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    email: l.email,
    source: l.source,
    responsible: l.responsible,
    status: l.status,
    tracking: l.tracking,
    metricLabel: null,
    metricAt: l.createdAt,
  }));

  const hasMore = leadsRaw.length > limit - 1;
  const nextCursor = hasMore ? leadsRaw[leadsRaw.length - 1]?.id ?? null : null;
  return { leads: leads.slice(0, limit - 1), nextCursor, total };
}

interface FetchCtx {
  metric: string;
  orgIds: string[];
  dateRange: { gte: Date; lte: Date } | undefined;
  trackingId: string | undefined;
  tagWhereLead: { leadTags: { some: { tagId: { in: string[] } } } } | undefined;
  statusId: string | undefined;
  source: string | undefined;
  utmCampaign: string | undefined;
  utmSource: string | undefined;
  limit: number;
  cursor: string | undefined;
}

// ─── Forge ──────────────────────────────────────────────────────────────

async function fetchForge({ metric, orgIds, dateRange, trackingId, tagWhereLead, limit, cursor }: FetchCtx) {
  const statusMap: Record<string, string | undefined> = {
    "forge.rascunho": "RASCUNHO",
    "forge.enviadas": "ENVIADA",
    "forge.visualizadas": "VISUALIZADA",
    "forge.pagas": "PAGA",
    "forge.expiradas": "EXPIRADA",
    "forge.canceladas": "CANCELADA",
    "forge.totalProposals": undefined,
  };
  const status = statusMap[metric];

  // Espelha o where do getAppsInsights, exceto que aqui exigimos clientId
  // (precisamos do Lead pra listar). O efeito disso é o seguinte: para
  // "totalProposals", o popup pode mostrar < que o card se houver propostas
  // sem cliente vinculado — comportamento aceitável (não há lead a mostrar).
  const where = {
    organizationId: { in: orgIds },
    clientId: { not: null as null },
    ...(status ? { status: status as "PAGA" } : {}),
    ...(dateRange ? { createdAt: dateRange } : {}),
    // trackingId no Forge é via Lead → tracking, não direto
    ...(trackingId ? { client: { is: { trackingId } } } : {}),
    // Tag filter aplicado via lead
    ...(tagWhereLead ? { client: { is: tagWhereLead } } : {}),
  } as Prisma.ForgeProposalWhereInput;

  // Se trackingId + tagWhereLead estiverem ambos presentes, precisamos
  // combinar AND no Lead. Caso raro mas precisa funcionar:
  if (trackingId && tagWhereLead) {
    (where as Record<string, unknown>).client = {
      is: { trackingId, ...tagWhereLead },
    };
  }

  const total = await prisma.forgeProposal.count({ where });

  const proposals = await prisma.forgeProposal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      client: { select: LEAD_SELECT },
    },
  });

  const leads: LeadRow[] = proposals
    .filter((p) => p.client)
    .map((p) => ({
      ...(p.client as NonNullable<typeof p.client>),
      metricLabel: p.title,
      metricAt: p.createdAt,
    }));

  const hasMore = proposals.length > limit - 1;
  const nextCursor = hasMore ? proposals[proposals.length - 1]?.id ?? null : null;
  return { leads: leads.slice(0, limit - 1), nextCursor, total };
}

// ─── SpaceTime ──────────────────────────────────────────────────────────

async function fetchSpacetime({ metric, orgIds, dateRange, trackingId, tagWhereLead, limit, cursor }: FetchCtx) {
  const statusMap: Record<string, string | undefined> = {
    "spacetime.total": undefined,
    "spacetime.withLead": undefined,
    "spacetime.pending": "PENDING",
    "spacetime.confirmed": "CONFIRMED",
    "spacetime.done": "DONE",
    "spacetime.cancelled": "CANCELLED",
    "spacetime.noShow": "NO_SHOW",
  };
  const status = statusMap[metric];

  // Espelha o where do getAppsInsights (agenda.organizationId), mas exige
  // leadId (precisamos do Lead pra listar).
  const where = {
    agenda: { organizationId: { in: orgIds } },
    leadId: { not: null as null },
    ...(status ? { status: status as "DONE" } : {}),
    ...(dateRange ? { startsAt: dateRange } : {}),
    ...(trackingId ? { trackingId } : {}),
    ...(tagWhereLead ? { lead: { is: tagWhereLead } } : {}),
  } as Prisma.AppointmentWhereInput;

  const total = await prisma.appointment.count({ where });

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { startsAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      status: true,
      startsAt: true,
      lead: { select: LEAD_SELECT },
    },
  });

  const leads: LeadRow[] = appointments
    .filter((a) => a.lead)
    .map((a) => ({
      ...(a.lead as NonNullable<typeof a.lead>),
      metricLabel: a.title,
      metricAt: a.startsAt,
    }));

  const hasMore = appointments.length > limit - 1;
  const nextCursor = hasMore ? appointments[appointments.length - 1]?.id ?? null : null;
  return { leads: leads.slice(0, limit - 1), nextCursor, total };
}

// ─── Chat ───────────────────────────────────────────────────────────────

async function fetchChat({ metric, orgIds, dateRange, trackingId, tagWhereLead, limit, cursor }: FetchCtx) {
  // Espelha exatamente getAppsInsights: attended = isActive=true,
  // unattended = isActive=false. Mantém compatibilidade com a contagem
  // dos cards.
  const isAttended = metric === "chat.attendedConversations";
  const isUnattended = metric === "chat.unattendedConversations";

  const where = {
    tracking: { organizationId: { in: orgIds } },
    ...(dateRange ? { createdAt: dateRange } : {}),
    ...(trackingId ? { trackingId } : {}),
    ...(tagWhereLead ? { lead: { is: tagWhereLead } } : {}),
    ...(isAttended ? { isActive: true } : {}),
    ...(isUnattended ? { isActive: false } : {}),
  } as Prisma.ConversationWhereInput;

  const total = await prisma.conversation.count({ where });

  const conversations = await prisma.conversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      lastMessageAt: true,
      lead: { select: LEAD_SELECT },
    },
  });

  const leads: LeadRow[] = conversations
    .filter((c) => c.lead)
    .map((c) => ({
      ...(c.lead as NonNullable<typeof c.lead>),
      metricLabel: c.name,
      metricAt: c.lastMessageAt,
    }));

  const hasMore = conversations.length > limit - 1;
  const nextCursor = hasMore ? conversations[conversations.length - 1]?.id ?? null : null;
  return { leads: leads.slice(0, limit - 1), nextCursor, total };
}
