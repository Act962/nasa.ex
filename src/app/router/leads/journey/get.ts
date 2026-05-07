import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import type { LeadJourneyEventKind } from "@/lib/lead-journey/track";

/**
 * Timeline unificada da jornada de um lead. Faz UNION de várias fontes:
 *   - LeadJourneyEvent (eventos granulares: status_changed, ctwa_referral, etc)
 *   - Conversation messages (filtra last 50 inbound/outbound)
 *   - Appointments (created/done/no_show)
 *   - FormResponses (submissions)
 *   - LinnkerScans
 *
 * Retorna ordenado desc (mais recente primeiro).
 */

interface TimelineEntry {
  id: string;
  kind: LeadJourneyEventKind;
  occurredAt: Date;
  actor: { id: string; name: string; image: string | null } | null;
  metadata: Record<string, unknown>;
  source: "journey_event" | "message" | "appointment" | "form" | "linnker";
}

export const getLeadJourney = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/leads/{leadId}/journey",
    summary: "Timeline cronológica unificada do lead",
  })
  .input(
    z.object({
      leadId: z.string(),
      limit: z.number().int().positive().max(500).optional().default(200),
    }),
  )
  .handler(async ({ input, errors }) => {
    const lead = await prisma.lead.findUnique({
      where: { id: input.leadId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        source: true,
        utmSource: true,
        utmCampaign: true,
        metaCampaignId: true,
        metaAdId: true,
        metaHeadline: true,
      },
    });
    if (!lead) throw errors.NOT_FOUND;

    // 5 fontes independentes — uma query cada, todas em paralelo
    const [journeyEvents, messages, appointments, formResponses, linnkerScans] =
      await Promise.all([
        prisma.leadJourneyEvent.findMany({
          where: { leadId: input.leadId },
          orderBy: { occurredAt: "desc" },
          take: input.limit,
          include: {
            actor: { select: { id: true, name: true, image: true } },
          },
        }),
        prisma.message.findMany({
          where: { conversation: { leadId: input.leadId } },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            body: true,
            fromMe: true,
            senderName: true,
            createdAt: true,
            mimetype: true,
          },
        }),
        prisma.appointment.findMany({
          where: { leadId: input.leadId },
          orderBy: { startsAt: "desc" },
          take: 30,
          select: {
            id: true,
            title: true,
            status: true,
            startsAt: true,
            createdAt: true,
          },
        }),
        prisma.formResponses.findMany({
          where: { leadId: input.leadId },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            createdAt: true,
            formId: true,
            form: { select: { id: true, name: true } },
          },
        }),
        prisma.linnkerScan.findMany({
          where: { leadId: input.leadId },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            createdAt: true,
            pageId: true,
            page: { select: { id: true, title: true, slug: true } },
          },
        }),
      ]);

    const fromJourney: TimelineEntry[] = journeyEvents.map((e) => ({
      id: `journey:${e.id}`,
      kind: e.kind as LeadJourneyEventKind,
      occurredAt: e.occurredAt,
      actor: e.actor,
      metadata: (e.metadata as Record<string, unknown>) ?? {},
      source: "journey_event",
    }));

    const fromMessages: TimelineEntry[] = messages.map((m) => ({
      id: `msg:${m.id}`,
      kind: m.fromMe ? "message_out" : "message_in",
      occurredAt: m.createdAt,
      actor: null,
      metadata: {
        body: m.body?.slice(0, 200),
        senderName: m.senderName,
        mimetype: m.mimetype,
      },
      source: "message",
    }));
    const fromAppointments: TimelineEntry[] = appointments.flatMap((a) => {
      const entries: TimelineEntry[] = [
        {
          id: `apt-created:${a.id}`,
          kind: "appointment_created",
          occurredAt: a.createdAt,
          actor: null,
          metadata: { appointmentId: a.id, title: a.title, startsAt: a.startsAt },
          source: "appointment",
        },
      ];
      if (a.status === "DONE") {
        entries.push({
          id: `apt-done:${a.id}`,
          kind: "appointment_done",
          occurredAt: a.startsAt,
          actor: null,
          metadata: { appointmentId: a.id, title: a.title },
          source: "appointment",
        });
      } else if (a.status === "NO_SHOW") {
        entries.push({
          id: `apt-noshow:${a.id}`,
          kind: "appointment_no_show",
          occurredAt: a.startsAt,
          actor: null,
          metadata: { appointmentId: a.id, title: a.title },
          source: "appointment",
        });
      }
      return entries;
    });

    const fromForms: TimelineEntry[] = formResponses.map((f) => ({
      id: `form:${f.id}`,
      kind: "form_submit",
      occurredAt: f.createdAt,
      actor: null,
      metadata: { formId: f.formId, formName: f.form?.name },
      source: "form",
    }));

    const fromLinnker: TimelineEntry[] = linnkerScans.map((s) => ({
      id: `linnker:${s.id}`,
      kind: "linnker_scan",
      occurredAt: s.createdAt,
      actor: null,
      metadata: {
        pageId: s.pageId,
        pageTitle: s.page?.title,
        pageSlug: s.page?.slug,
      },
      source: "linnker",
    }));

    // Merge + ordena desc + dedupe (journey_event tem prioridade quando kind+occurredAt batem)
    const merged: TimelineEntry[] = [
      ...fromJourney,
      ...fromMessages,
      ...fromAppointments,
      ...fromForms,
      ...fromLinnker,
    ];

    merged.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return {
      lead: {
        id: lead.id,
        name: lead.name,
        createdAt: lead.createdAt,
        source: lead.source,
        utmSource: lead.utmSource,
        utmCampaign: lead.utmCampaign,
        metaCampaignId: lead.metaCampaignId,
        metaAdId: lead.metaAdId,
        metaHeadline: lead.metaHeadline,
      },
      events: merged.slice(0, input.limit),
    };
  });
