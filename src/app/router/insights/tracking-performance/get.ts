import { z } from "zod";
import prisma from "@/lib/prisma";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

/**
 * Métricas de performance de Tracking — alimentam KPIs específicos da
 * seção Tracking que NÃO ficam em `getAppsInsights` por exigirem
 * queries pesadas sobre `LeadHistory` e `Message`.
 *
 * Chamado sob demanda apenas quando o usuário tem pelo menos 1 KPI de
 * tracking-performance ativado em `section-prefs`.
 */
export const getTrackingPerformance = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/insights/tracking-performance",
    summary:
      "Métricas de performance de Tracking (tempo por status, performance por atendente)",
  })
  .input(
    z.object({
      organizationIds: z.array(z.string()).optional(),
      trackingId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  )
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

    const baseLeadWhere = {
      tracking: { organizationId: { in: orgIds } },
      ...(input.trackingId ? { trackingId: input.trackingId } : {}),
      ...(dateRange ? { createdAt: dateRange } : {}),
    } as const;

    // ── Tempo médio por status ──────────────────────────────────────────
    // Estratégia: pega todos os LeadHistory com STATUS_CHANGE no período,
    // agrupa por `previousStatusId` (= status do qual o lead saiu) e
    // calcula o intervalo médio entre eventos consecutivos do mesmo lead.
    // Os leads ativos não saíram do status atual — não entram na conta.
    const statusChanges = await prisma.leadHistory.findMany({
      where: {
        lead: baseLeadWhere,
        eventType: "STATUS_CHANGE",
        ...(dateRange ? { createdAt: dateRange } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: {
        leadId: true,
        previousStatusId: true,
        newStatusId: true,
        createdAt: true,
      },
    });

    // Map<statusId, { totalMs, count }> — tempo passado em `previousStatusId`
    // calculado como (createdAt - prevEventDoMesmoLead).
    const timePerStatus = new Map<string, { totalMs: number; count: number }>();
    const lastEventByLead = new Map<string, Date>();

    for (const ev of statusChanges) {
      const prevDate = lastEventByLead.get(ev.leadId);
      if (prevDate && ev.previousStatusId) {
        const ms = ev.createdAt.getTime() - prevDate.getTime();
        if (ms > 0) {
          const cur = timePerStatus.get(ev.previousStatusId) ?? {
            totalMs: 0,
            count: 0,
          };
          cur.totalMs += ms;
          cur.count++;
          timePerStatus.set(ev.previousStatusId, cur);
        }
      }
      lastEventByLead.set(ev.leadId, ev.createdAt);
    }

    // Resolve nomes/cores dos statuses pra UI
    const statusIds = Array.from(timePerStatus.keys());
    const statuses = statusIds.length
      ? await prisma.status.findMany({
          where: { id: { in: statusIds } },
          select: { id: true, name: true, color: true },
        })
      : [];

    const avgTimePerStatus = statuses
      .map((s) => {
        const stats = timePerStatus.get(s.id);
        return {
          statusId: s.id,
          name: s.name,
          color: s.color,
          avgHours: stats ? stats.totalMs / stats.count / (1000 * 60 * 60) : 0,
          sample: stats?.count ?? 0,
        };
      })
      .sort((a, b) => b.avgHours - a.avgHours);

    // ── Performance por atendente ────────────────────────────────────────
    // Pega todos os leads do período + responsibleId. Pra cada um,
    // calcula:
    //  - 1ª resposta: primeira Message com fromMe=true após createdAt
    //  - conversão: lead.currentAction === "WON"
    const leads = await prisma.lead.findMany({
      where: {
        ...baseLeadWhere,
        responsibleId: { not: null },
      },
      select: {
        id: true,
        responsibleId: true,
        currentAction: true,
        createdAt: true,
      },
    });

    const leadIds = leads.map((l) => l.id);

    // Primeira mensagem fromMe=true por leadId
    const firstResponses = leadIds.length
      ? await prisma.message.groupBy({
          by: ["conversationId"],
          where: {
            fromMe: true,
            conversation: { leadId: { in: leadIds } },
          },
          _min: { createdAt: true },
        })
      : [];

    // Mapear conversationId → leadId
    const conversationToLead = leadIds.length
      ? await prisma.conversation.findMany({
          where: { leadId: { in: leadIds } },
          select: { id: true, leadId: true },
        })
      : [];
    const convToLeadMap = new Map(
      conversationToLead.map((c) => [c.id, c.leadId]),
    );

    // leadId → tempo (ms) até primeira resposta
    const responseTimeByLead = new Map<string, number>();
    for (const r of firstResponses) {
      const leadId = convToLeadMap.get(r.conversationId);
      if (!leadId || !r._min.createdAt) continue;
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) continue;
      const ms = r._min.createdAt.getTime() - lead.createdAt.getTime();
      if (ms > 0) responseTimeByLead.set(leadId, ms);
    }

    // Agrega por responsibleId
    type Agg = { total: number; won: number; sumResponseMs: number; respCount: number };
    const agg = new Map<string, Agg>();
    for (const l of leads) {
      if (!l.responsibleId) continue;
      const cur = agg.get(l.responsibleId) ?? {
        total: 0,
        won: 0,
        sumResponseMs: 0,
        respCount: 0,
      };
      cur.total++;
      if (l.currentAction === "WON") cur.won++;
      const respMs = responseTimeByLead.get(l.id);
      if (respMs != null) {
        cur.sumResponseMs += respMs;
        cur.respCount++;
      }
      agg.set(l.responsibleId, cur);
    }

    const userIds = Array.from(agg.keys());
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, image: true },
        })
      : [];

    const avgFirstResponseByAttendant = users
      .map((u) => {
        const a = agg.get(u.id)!;
        return {
          userId: u.id,
          name: u.name,
          image: u.image,
          avgHours:
            a.respCount > 0 ? a.sumResponseMs / a.respCount / (1000 * 60 * 60) : 0,
          sample: a.respCount,
        };
      })
      .filter((u) => u.sample > 0)
      .sort((a, b) => a.avgHours - b.avgHours)
      .slice(0, 5);

    const conversionRateByAttendant = users
      .map((u) => {
        const a = agg.get(u.id)!;
        return {
          userId: u.id,
          name: u.name,
          image: u.image,
          total: a.total,
          won: a.won,
          rate: a.total > 0 ? (a.won / a.total) * 100 : 0,
        };
      })
      .filter((u) => u.total > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);

    return {
      avgTimePerStatus,
      avgFirstResponseByAttendant,
      conversionRateByAttendant,
    };
  });
