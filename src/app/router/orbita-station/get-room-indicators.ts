import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { waitingLeadWhere } from "@/features/alerts/lib/waiting-lead";
import { getUserPermissionsForApps } from "@/features/permissions/server/app-permission";
import prisma from "@/lib/prisma";

const WAITING_LEADS_SHOWN = 8;
const LIST_LIMIT = 5;
// Sem fuso por empresa no schema: "hoje" é o dia em São Paulo, UTC-3 fixo desde 2019 (CB-8).
const BUSINESS_UTC_OFFSET = "-03:00";
const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

function businessDayBounds(now: Date) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE }).format(now);
  const start = new Date(`${day}T00:00:00${BUSINESS_UTC_OFFSET}`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/** "Maria Silva" vira "Maria S.". Nome que é só telefone vira "Cliente": o número não sai do servidor (RNF-4, CB-6). */
function shortLeadName(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => /\p{L}/u.test(word));
  if (words.length === 0) return "Cliente";
  return words.length > 1 ? `${words[0]} ${words[words.length - 1][0].toUpperCase()}.` : words[0];
}

/**
 * Indicadores das salas da estação (spec 0121). Cada bloco só é calculado com **Ver** no app do módulo e com o mesmo
 * escopo que o módulo usa: leads e agendas pelos funis em que a pessoa participa, tarefas pelas dela (RNF-1).
 */
export const getRoomIndicators = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/orbita-station/room-indicators", summary: "Indicadores das salas da estação 3D" })
  .handler(async ({ context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.FORBIDDEN({ message: "Escolha uma empresa para entrar na estação." });
    const userId = context.user.id;
    const now = new Date();
    const today = businessDayBounds(now);

    const permissions = await getUserPermissionsForApps(organizationId, userId, ["chat", "tracking", "workspace", "financeiro", "spacetime", "forge"]);
    const canView = (appKey: string) => permissions?.[appKey]?.canView === true;
    const needsTrackings = canView("chat") || canView("tracking") || canView("spacetime");
    const trackingIds = needsTrackings
      ? (
          await prisma.tracking.findMany({
            where: { organizationId, participants: { some: { userId } } },
            select: { id: true },
          })
        ).map((tracking) => tracking.id)
      : [];
    const hasTrackings = trackingIds.length > 0;

    const chat = async () => {
      if (!canView("chat")) return null;
      if (!hasTrackings) return { waitingCount: 0, oldestWaitingSince: null, leads: [], hasTrackings };
      const where = { ...waitingLeadWhere(now.getTime()), trackingId: { in: trackingIds } };
      const [waitingCount, leads] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.findMany({
          where,
          orderBy: { lastInboundAt: "asc" },
          take: WAITING_LEADS_SHOWN,
          select: { id: true, name: true, lastInboundAt: true, conversation: { select: { id: true, channel: true } } },
        }),
      ]);
      return {
        waitingCount,
        oldestWaitingSince: leads[0]?.lastInboundAt?.toISOString() ?? null,
        leads: leads.flatMap((lead) =>
          lead.conversation && lead.lastInboundAt
            ? [
                {
                  id: lead.id,
                  name: shortLeadName(lead.name),
                  channel: lead.conversation.channel,
                  waitingSince: lead.lastInboundAt.toISOString(),
                  conversationId: lead.conversation.id,
                },
              ]
            : [],
        ),
        hasTrackings,
      };
    };

    const arrivals = async () => {
      if (!canView("tracking")) return null;
      if (!hasTrackings) return { createdToday: 0, topSources: [], hasTrackings };
      const where = { trackingId: { in: trackingIds }, createdAt: { gte: today.start, lt: today.end } };
      const [createdToday, bySource] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.groupBy({ by: ["source"], where, _count: { _all: true }, orderBy: { _count: { source: "desc" } }, take: 3 }),
      ]);
      return { createdToday, topSources: bySource.map((group) => ({ source: group.source, count: group._count._all })), hasTrackings };
    };

    const tasks = async () => {
      if (!canView("workspace")) return null;
      const mine = {
        isDone: false,
        isArchived: false,
        responsibles: { some: { userId } },
        workspace: { organizationId },
      };
      const [overdueCount, dueTodayCount, overdue] = await Promise.all([
        prisma.action.count({ where: { ...mine, dueDate: { lt: now } } }),
        prisma.action.count({ where: { ...mine, dueDate: { gte: now, lt: today.end } } }),
        prisma.action.findMany({
          where: { ...mine, dueDate: { lt: now } },
          orderBy: { dueDate: "asc" },
          take: LIST_LIMIT,
          select: { id: true, title: true, dueDate: true },
        }),
      ]);
      return {
        overdueCount,
        dueTodayCount,
        overdue: overdue.map((task) => ({ id: task.id, title: task.title, dueDate: task.dueDate?.toISOString() ?? null })),
      };
    };

    const finance = async () => {
      if (!canView("financeiro")) return null;
      const receivable = { organizationId, type: "RECEIVABLE" as const };
      const [overdue, dueToday] = await Promise.all([
        prisma.paymentEntry.aggregate({
          where: { ...receivable, OR: [{ status: "OVERDUE" }, { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: today.start } }] },
          _count: { _all: true },
          _sum: { amount: true, paidAmount: true },
        }),
        prisma.paymentEntry.aggregate({
          where: { ...receivable, status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today.start, lt: today.end } },
          _sum: { amount: true, paidAmount: true },
        }),
      ]);
      const openCents = (sum: { amount: number | null; paidAmount: number | null }) => (sum.amount ?? 0) - (sum.paidAmount ?? 0);
      return { overdueCount: overdue._count._all, overdueCents: openCents(overdue._sum), dueTodayCents: openCents(dueToday._sum) };
    };

    const agenda = async () => {
      if (!canView("spacetime")) return null;
      if (!hasTrackings) return { upcoming: [], hasTrackings };
      const upcoming = await prisma.appointment.findMany({
        where: {
          agenda: { organizationId, trackingId: { in: trackingIds } },
          status: { not: "CANCELLED" },
          startsAt: { gte: now, lt: today.end },
        },
        orderBy: { startsAt: "asc" },
        take: LIST_LIMIT,
        select: { id: true, title: true, startsAt: true, status: true },
      });
      return {
        upcoming: upcoming.map((appointment) => ({ ...appointment, title: appointment.title ?? "Compromisso", startsAt: appointment.startsAt.toISOString() })),
        hasTrackings,
      };
    };

    const sales = async () => {
      if (!canView("forge")) return null;
      const [openProposals, draftProposals, contractsToSign] = await Promise.all([
        prisma.forgeProposal.count({ where: { organizationId, status: { in: ["RASCUNHO", "ENVIADA", "VISUALIZADA"] } } }),
        prisma.forgeProposal.count({ where: { organizationId, status: "RASCUNHO" } }),
        prisma.forgeContract.count({ where: { organizationId, status: "PENDENTE_ASSINATURA" } }),
      ]);
      return { openProposals, draftProposals, contractsToSign };
    };

    const [chatBlock, arrivalsBlock, tasksBlock, financeBlock, agendaBlock, salesBlock] = await Promise.all([
      chat(),
      arrivals(),
      tasks(),
      finance(),
      agenda(),
      sales(),
    ]);
    return {
      generatedAt: now.toISOString(),
      chat: chatBlock,
      arrivals: arrivalsBlock,
      tasks: tasksBlock,
      finance: financeBlock,
      agenda: agendaBlock,
      sales: salesBlock,
    };
  });
