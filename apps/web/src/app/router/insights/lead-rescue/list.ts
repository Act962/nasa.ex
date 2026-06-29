import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../../middlewares/auth";
import { requireOrgMiddleware } from "../../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  computeRescueBuckets,
  DEFAULT_RESCUE_CONFIG,
  hoursUntilSlaBreach,
  type LeadRescueSnapshot,
} from "@/lib/lead-journey/sla";

/**
 * Lista de leads que precisam de atenção, classificados em até 4 buckets:
 *  - `noResponse`: estourou SLA de primeira resposta
 *  - `unassigned`: sem responsável definido
 *  - `stuckInStage`: parado na mesma etapa há mais de N dias
 *  - `noShow`: appointment marcado como NO_SHOW sem follow-up posterior
 *
 * O filtro busca leads ATIVOS (não WON/LOST/DELETED). Aceita filtro por
 * tracking, lista de organizações (para Workspace), e thresholds custom.
 */
export const listLeadRescue = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/insights/lead-rescue",
    summary: "Lista leads para resgatar agrupados em buckets (SLA, sem responsável, parado, no-show)",
  })
  .input(
    z.object({
      trackingId: z.string().optional(),
      organizationIds: z.array(z.string()).optional(),
      slaHours: z.number().int().positive().optional(),
      stuckDays: z.number().int().positive().optional(),
      limit: z.number().int().positive().max(200).optional().default(50),
    }),
  )
  .handler(async ({ input, context }) => {
    const { org } = context;
    const config = {
      slaHours: input.slaHours ?? DEFAULT_RESCUE_CONFIG.slaHours,
      stuckDays: input.stuckDays ?? DEFAULT_RESCUE_CONFIG.stuckDays,
    };
    const now = new Date();

    // Quais orgs olhar
    const orgIds =
      input.organizationIds && input.organizationIds.length > 0
        ? input.organizationIds
        : [org.id];

    const whereBase = {
      currentAction: "ACTIVE" as const,
      isActive: true,
      ...(input.trackingId ? { trackingId: input.trackingId } : {}),
      tracking: { organizationId: { in: orgIds } },
    };

    // Buscamos um corte amplo e classificamos em memória — número de leads
    // ativos é geralmente pequeno o suficiente. Limit defensivo: 1000.
    const leads = await prisma.lead.findMany({
      where: whereBase,
      orderBy: { updatedAt: "desc" },
      take: 1000,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        source: true,
        responsibleId: true,
        statusId: true,
        trackingId: true,
        lastInboundAt: true,
        lastOutboundAt: true,
        firstResponseAt: true,
        lastStatusChangeAt: true,
        createdAt: true,
        responsible: { select: { id: true, name: true, image: true } },
        status: { select: { id: true, name: true, color: true } },
        tracking: { select: { id: true, name: true, organizationId: true } },
      },
    });

    // No-show: appointments com NO_SHOW sem follow-up
    const noShowAppointments = await prisma.appointment.findMany({
      where: {
        status: "NO_SHOW",
        leadId: { in: leads.map((l) => l.id) },
      },
      orderBy: { startsAt: "desc" },
      select: { leadId: true, startsAt: true, title: true, id: true },
    });

    // Para cada leadId, pega o último appointment NO_SHOW
    const lastNoShowByLead = new Map<string, (typeof noShowAppointments)[number]>();
    for (const ap of noShowAppointments) {
      if (!ap.leadId) continue;
      const cur = lastNoShowByLead.get(ap.leadId);
      if (!cur || cur.startsAt < ap.startsAt) lastNoShowByLead.set(ap.leadId, ap);
    }

    // Filtra: só conta como rescue se NÃO houve appointment posterior (qualquer status)
    const noShowLeadIds = new Set<string>();
    if (lastNoShowByLead.size > 0) {
      const followUps = await prisma.appointment.findMany({
        where: {
          leadId: { in: Array.from(lastNoShowByLead.keys()) },
          status: { notIn: ["NO_SHOW", "CANCELLED"] },
        },
        select: { leadId: true, startsAt: true },
      });
      const followUpMap = new Map<string, Date>();
      for (const f of followUps) {
        if (!f.leadId) continue;
        const cur = followUpMap.get(f.leadId);
        if (!cur || cur < f.startsAt) followUpMap.set(f.leadId, f.startsAt);
      }
      for (const [leadId, ns] of lastNoShowByLead) {
        const followUp = followUpMap.get(leadId);
        if (!followUp || followUp < ns.startsAt) noShowLeadIds.add(leadId);
      }
    }

    // Classifica
    const noResponse: typeof leads = [];
    const unassigned: typeof leads = [];
    const stuckInStage: typeof leads = [];
    const noShow: typeof leads = [];

    for (const lead of leads) {
      const snap: LeadRescueSnapshot = {
        id: lead.id,
        responsibleId: lead.responsibleId,
        lastInboundAt: lead.lastInboundAt,
        lastOutboundAt: lead.lastOutboundAt,
        firstResponseAt: lead.firstResponseAt,
        lastStatusChangeAt: lead.lastStatusChangeAt,
        createdAt: lead.createdAt,
      };
      const buckets = computeRescueBuckets(snap, config, now);
      if (buckets.includes("noResponse")) noResponse.push(lead);
      if (buckets.includes("unassigned")) unassigned.push(lead);
      if (buckets.includes("stuckInStage")) stuckInStage.push(lead);
      if (noShowLeadIds.has(lead.id)) noShow.push(lead);
    }

    // Enriquece com horas de SLA / dias parado
    const enrich = (rows: typeof leads, kind: "sla" | "stuck" | "raw") =>
      rows.slice(0, input.limit).map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        source: l.source,
        responsible: l.responsible,
        status: l.status,
        tracking: l.tracking,
        lastInboundAt: l.lastInboundAt,
        firstResponseAt: l.firstResponseAt,
        slaHoursLeft:
          kind === "sla"
            ? hoursUntilSlaBreach(
                {
                  id: l.id,
                  responsibleId: l.responsibleId,
                  lastInboundAt: l.lastInboundAt,
                  lastOutboundAt: l.lastOutboundAt,
                  firstResponseAt: l.firstResponseAt,
                  lastStatusChangeAt: l.lastStatusChangeAt,
                  createdAt: l.createdAt,
                },
                config,
                now,
              )
            : null,
        daysInStage:
          kind === "stuck"
            ? Math.floor(
                (now.getTime() -
                  (l.lastStatusChangeAt ?? l.createdAt).getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : null,
      }));

    return {
      config,
      counts: {
        noResponse: noResponse.length,
        unassigned: unassigned.length,
        stuckInStage: stuckInStage.length,
        noShow: noShow.length,
        total:
          noResponse.length +
          unassigned.length +
          stuckInStage.length +
          noShow.length,
      },
      buckets: {
        noResponse: enrich(noResponse, "sla"),
        unassigned: enrich(unassigned, "raw"),
        stuckInStage: enrich(stuckInStage, "stuck"),
        noShow: enrich(noShow, "raw"),
      },
    };
  });
