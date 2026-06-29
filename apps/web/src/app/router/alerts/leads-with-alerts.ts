import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { APP_KEYS, type AppKey } from "@/features/alerts/lib/alert-catalog";

/**
 * Lista leads (DISTINTOS) que tiveram alertas disparados recentemente.
 *
 * Usado pela aba Automações de cada App (a primeira surface foi Tracking)
 * pra dar drill-down rápido nos leads "em atenção" — clica e vai pra
 * `/contatos/<leadId>`.
 *
 * Filtro de visibilidade: as MESMAS regras de `userNotifications.list`
 * (targetType=all OU user(targetId=me) OU org(targetId IN minhas orgs)).
 *
 * Filtro de evento: apenas eventTypes que carregam `leadId` no payload.
 * Quando `appKey=tracking`, restringe a `lead.*`. Pra outros apps que
 * também tocam leads (forge), aceita o prefixo do app.
 *
 * Estratégia: lê últimas N notificações visíveis (cap 500) ordenadas por
 * data, dedupa por leadId em memória, depois pagina. Bom o suficiente
 * pra o caso de uso (mostrar leads "ativos" em alertas).
 */
export const listLeadsWithAlerts = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/alerts/leads-with-alerts",
    summary: "Lista distinta de leads com alertas recentes",
  })
  .input(
    z.object({
      appKey: z.enum(APP_KEYS).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(10),
      sinceDays: z.coerce.number().int().min(1).max(180).default(30),
    }),
  )
  .output(
    z.object({
      items: z.array(
        z.object({
          leadId: z.string(),
          leadName: z.string(),
          leadPhone: z.string().nullable(),
          trackingId: z.string().nullable(),
          trackingName: z.string().nullable(),
          statusName: z.string().nullable(),
          statusColor: z.string().nullable(),
          lastAlertAt: z.string(),
          lastAlertTitle: z.string(),
          lastAlertSeverity: z.string(),
          alertCount: z.number(),
        }),
      ),
      page: z.number(),
      pageSize: z.number(),
      totalLeads: z.number(),
      hasMore: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const userId = context.user.id;
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    const userOrgs = (
      await prisma.member.findMany({
        where: { userId },
        select: { organizationId: true },
      })
    ).map((m) => m.organizationId);

    const since = new Date(
      Date.now() - input.sinceDays * 24 * 60 * 60 * 1000,
    );

    // Filtro de eventType por app: deriva prefixo do appKey.
    // tracking → lead.* ; workspace → action.* ; agenda → agenda.*
    // forge → forge.* ; forms → form.* ; chat → chat.*
    // integracoes → integration.* ; insights → metric.*
    const eventPrefix = input.appKey ? appPrefixMap[input.appKey] : null;
    const eventTypeFilter = eventPrefix
      ? { startsWith: eventPrefix }
      : undefined;

    // Le últimas 500 notificações visíveis (best-effort window).
    const notifications = await prisma.adminNotification.findMany({
      where: {
        OR: [
          { targetType: "all" },
          { targetType: "user", targetId: userId },
          { targetType: "org", targetId: { in: userOrgs } },
        ],
        createdAt: { gte: since },
        ...(eventTypeFilter ? { eventType: eventTypeFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        title: true,
        severity: true,
        eventType: true,
        eventPayload: true,
        createdAt: true,
      },
    });

    // Dedupe por leadId, mantendo o alerta mais recente como "lastAlert".
    type Bucket = {
      leadId: string;
      lastAlertAt: Date;
      lastAlertTitle: string;
      lastAlertSeverity: string;
      alertCount: number;
    };
    const byLead = new Map<string, Bucket>();
    for (const n of notifications) {
      const payload = (n.eventPayload as Record<string, unknown> | null) ?? {};
      const leadId =
        typeof payload.leadId === "string" ? payload.leadId : null;
      if (!leadId) continue;
      const existing = byLead.get(leadId);
      if (existing) {
        existing.alertCount += 1;
        // notifications já vem desc; o primeiro hit é o mais recente.
        continue;
      }
      byLead.set(leadId, {
        leadId,
        lastAlertAt: n.createdAt,
        lastAlertTitle: n.title,
        lastAlertSeverity: n.severity,
        alertCount: 1,
      });
    }

    const allLeadIds = Array.from(byLead.keys());
    const totalLeads = allLeadIds.length;

    // Pagina sobre a lista deduplicada (já ordenada por lastAlertAt desc
    // graças à ordem de inserção do Map).
    const offset = (input.page - 1) * input.pageSize;
    const pageLeadIds = allLeadIds.slice(offset, offset + input.pageSize);

    if (pageLeadIds.length === 0) {
      return {
        items: [],
        page: input.page,
        pageSize: input.pageSize,
        totalLeads,
        hasMore: false,
      };
    }

    // Fetch dados dos leads dessa página (limitado ao org ativo).
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: pageLeadIds },
        tracking: { organizationId },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        trackingId: true,
        tracking: { select: { name: true } },
        status: { select: { name: true, color: true } },
      },
    });
    const leadMap = new Map(leads.map((l) => [l.id, l]));

    const items = pageLeadIds
      .map((leadId) => {
        const bucket = byLead.get(leadId)!;
        const lead = leadMap.get(leadId);
        if (!lead) return null; // lead pode ter sido apagado ou estar em outra org
        return {
          leadId: lead.id,
          leadName: lead.name,
          leadPhone: lead.phone ?? null,
          trackingId: lead.trackingId ?? null,
          trackingName: lead.tracking?.name ?? null,
          statusName: lead.status?.name ?? null,
          statusColor: lead.status?.color ?? null,
          lastAlertAt: bucket.lastAlertAt.toISOString(),
          lastAlertTitle: bucket.lastAlertTitle,
          lastAlertSeverity: bucket.lastAlertSeverity,
          alertCount: bucket.alertCount,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      totalLeads,
      hasMore: offset + input.pageSize < totalLeads,
    };
  });

/** Mapa appKey → prefix do eventType. Mantém alinhado com alert-catalog. */
const appPrefixMap: Record<AppKey, string> = {
  tracking: "lead.",
  workspace: "action.",
  agenda: "agenda.",
  chat: "chat.",
  forge: "forge.",
  forms: "form.",
  integracoes: "integration.",
  insights: "metric.",
  admin: "broadcast.",
};
