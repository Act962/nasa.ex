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
  // String em vez de enum estrito pra acomodar kinds extras vindos do
  // LeadHistory legado (tracking_changed, tag_removed, file_uploaded,
  // note, sla_breached, public_link_viewed, deleted).
  kind: LeadJourneyEventKind | string;
  occurredAt: Date;
  actor: { id: string; name: string; image: string | null } | null;
  metadata: Record<string, unknown>;
  source:
    | "journey_event"
    | "message"
    | "appointment"
    | "form"
    | "linnker"
    | "history";
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

    // 6 fontes independentes — uma query cada, todas em paralelo. A nova
    // (`historyRows`) trás o LeadHistory legado (status, responsável,
    // arquivos, tags, etc.) que muitas procedures antigas ainda gravam
    // SEM espelhar em LeadJourneyEvent. Sem isso, o tab "Jornada" mostrava
    // só os eventos novos e não unificava com o histórico completo.
    const [
      journeyEvents,
      messages,
      appointments,
      formResponses,
      linnkerScans,
      historyRows,
    ] = await Promise.all([
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
        (prisma.leadHistory.findMany as (args: unknown) => Promise<unknown[]>)({
          where: { leadId: input.leadId },
          orderBy: { createdAt: "desc" },
          take: input.limit,
          select: {
            id: true,
            createdAt: true,
            action: true,
            eventType: true,
            notes: true,
            metadata: true,
            previousStatusId: true,
            newStatusId: true,
            previousTrackingId: true,
            newTrackingId: true,
            previousResponsibleId: true,
            newResponsibleId: true,
            userId: true,
            user: { select: { id: true, name: true, image: true } },
          },
        }),
      ]);

    // ── Resolve IDs em batch (status, tracking, user, form, tag) ────
    // Tanto LeadJourneyEvent.metadata quanto LeadHistory podem referenciar
    // entidades por ID; resolvemos em UMA query batch por entidade pra
    // depois embutir os nomes no metadata (a UI lê `metadata.from`,
    // `metadata.to`, `metadata.responsibleName`, etc.).
    const typedHistory = historyRows as Array<{
      id: string;
      createdAt: Date;
      action: string;
      eventType: string | null;
      notes: string | null;
      metadata: unknown;
      previousStatusId: string | null;
      newStatusId: string | null;
      previousTrackingId: string | null;
      newTrackingId: string | null;
      previousResponsibleId: string | null;
      newResponsibleId: string | null;
      userId: string | null;
      user: { id: string; name: string; image: string | null } | null;
    }>;

    const statusIds = new Set<string>();
    const trackingIds = new Set<string>();
    const userIds = new Set<string>();
    const formIds = new Set<string>();
    const tagIds = new Set<string>();

    for (const e of journeyEvents) {
      const m = (e.metadata as Record<string, unknown>) ?? {};
      if (typeof m.previousStatusId === "string") statusIds.add(m.previousStatusId);
      if (typeof m.newStatusId === "string") statusIds.add(m.newStatusId);
      if (typeof m.previousTrackingId === "string") trackingIds.add(m.previousTrackingId);
      if (typeof m.newTrackingId === "string") trackingIds.add(m.newTrackingId);
      if (typeof m.previousResponsibleId === "string") userIds.add(m.previousResponsibleId);
      if (typeof m.newResponsibleId === "string") userIds.add(m.newResponsibleId);
      if (typeof m.formId === "string") formIds.add(m.formId);
      if (typeof m.tagId === "string") tagIds.add(m.tagId);
    }
    for (const h of typedHistory) {
      if (h.previousStatusId) statusIds.add(h.previousStatusId);
      if (h.newStatusId) statusIds.add(h.newStatusId);
      if (h.previousTrackingId) trackingIds.add(h.previousTrackingId);
      if (h.newTrackingId) trackingIds.add(h.newTrackingId);
      if (h.previousResponsibleId) userIds.add(h.previousResponsibleId);
      if (h.newResponsibleId) userIds.add(h.newResponsibleId);
      const meta = (h.metadata ?? {}) as Record<string, unknown>;
      if (typeof meta.formId === "string") formIds.add(meta.formId);
      if (typeof meta.tagId === "string") tagIds.add(meta.tagId);
    }

    const [statuses, trackings, users, forms, tags] = await Promise.all([
      statusIds.size
        ? prisma.status.findMany({
            where: { id: { in: Array.from(statusIds) } },
            select: { id: true, name: true, color: true },
          })
        : Promise.resolve<Array<{ id: string; name: string; color: string | null }>>([]),
      trackingIds.size
        ? prisma.tracking.findMany({
            where: { id: { in: Array.from(trackingIds) } },
            select: { id: true, name: true },
          })
        : Promise.resolve<Array<{ id: string; name: string }>>([]),
      userIds.size
        ? prisma.user.findMany({
            where: { id: { in: Array.from(userIds) } },
            select: { id: true, name: true, image: true },
          })
        : Promise.resolve<Array<{ id: string; name: string | null; image: string | null }>>([]),
      formIds.size
        ? prisma.form.findMany({
            where: { id: { in: Array.from(formIds) } },
            select: { id: true, name: true },
          })
        : Promise.resolve<Array<{ id: string; name: string }>>([]),
      tagIds.size
        ? prisma.tag.findMany({
            where: { id: { in: Array.from(tagIds) } },
            select: { id: true, name: true, color: true },
          })
        : Promise.resolve<Array<{ id: string; name: string; color: string | null }>>([]),
    ]);

    const statusById = new Map(statuses.map((s) => [s.id, s]));
    const trackingById = new Map(trackings.map((t) => [t.id, t]));
    const userById = new Map(users.map((u) => [u.id, u]));
    const formById = new Map(forms.map((f) => [f.id, f]));
    const tagById = new Map(tags.map((t) => [t.id, t]));

    // Helpers
    const statusName = (id?: string | null) =>
      id ? statusById.get(id)?.name ?? null : null;
    const statusColor = (id?: string | null) =>
      id ? statusById.get(id)?.color ?? null : null;
    const trackingName = (id?: string | null) =>
      id ? trackingById.get(id)?.name ?? null : null;
    const userObj = (id?: string | null) => {
      if (!id) return null;
      const u = userById.get(id);
      if (!u) return null;
      return { id: u.id, name: u.name ?? "Usuário", image: u.image };
    };
    const formName = (id?: string | null) =>
      id ? formById.get(id)?.name ?? null : null;
    const tagInfo = (id?: string | null) => (id ? tagById.get(id) ?? null : null);

    // ── Converte LeadJourneyEvent (enriquece metadata com nomes) ──────
    const fromJourney: TimelineEntry[] = journeyEvents.map((e) => {
      const m = ((e.metadata as Record<string, unknown>) ?? {}) as Record<
        string,
        unknown
      >;
      const enriched = { ...m };

      if (e.kind === "status_changed") {
        const prevId = typeof m.previousStatusId === "string" ? m.previousStatusId : null;
        const newId = typeof m.newStatusId === "string" ? m.newStatusId : null;
        enriched.from = statusName(prevId) ?? m.from ?? null;
        enriched.to = statusName(newId) ?? m.to ?? null;
        enriched.fromColor = statusColor(prevId);
        enriched.toColor = statusColor(newId);
      }
      if (e.kind === "lead_assigned") {
        const newId = typeof m.newResponsibleId === "string" ? m.newResponsibleId : null;
        const newOne = userObj(newId);
        if (newOne) {
          enriched.responsibleName = newOne.name;
          enriched.responsibleImage = newOne.image;
        }
      }
      if (e.kind === "tag_added") {
        const tId = typeof m.tagId === "string" ? m.tagId : null;
        const tag = tagInfo(tId);
        if (tag) {
          enriched.tagName = tag.name;
          enriched.tagColor = tag.color;
        }
      }
      if (e.kind === "form_submit") {
        const fId = typeof m.formId === "string" ? m.formId : null;
        if (fId) enriched.formName = formName(fId);
      }

      return {
        id: `journey:${e.id}`,
        kind: e.kind as LeadJourneyEventKind,
        occurredAt: e.occurredAt,
        actor: e.actor,
        metadata: enriched,
        source: "journey_event",
      };
    });

    // ── Converte LeadHistory legado em TimelineEntry ──────────────────
    // Filtra ruído: action=ACTIVE sem eventType são side-effects de
    // outras procedures (ex: file upload, tag toggle) que já gravam
    // o evento "real" via LeadJourneyEvent. Mantemos só entries com
    // eventType explícito ou actions terminais (WON/LOST/DELETED).
    const fromHistory: TimelineEntry[] = typedHistory
      .map((h): TimelineEntry | null => {
        const meta = ((h.metadata ?? {}) as Record<string, unknown>) ?? {};
        const actor = h.user
          ? { id: h.user.id, name: h.user.name, image: h.user.image }
          : null;

        if (h.eventType === "STATUS_CHANGE") {
          return {
            id: `history:${h.id}`,
            kind: "status_changed",
            occurredAt: h.createdAt,
            actor,
            source: "history",
            metadata: {
              ...meta,
              from: statusName(h.previousStatusId),
              to: statusName(h.newStatusId),
              fromColor: statusColor(h.previousStatusId),
              toColor: statusColor(h.newStatusId),
            },
          };
        }
        if (h.eventType === "TRACKING_CHANGE") {
          return {
            id: `history:${h.id}`,
            kind: "tracking_changed",
            occurredAt: h.createdAt,
            actor,
            source: "history",
            metadata: {
              ...meta,
              from: trackingName(h.previousTrackingId),
              to: trackingName(h.newTrackingId),
            },
          };
        }
        if (h.eventType === "RESPONSIBLE_CHANGE") {
          const newOne = userObj(h.newResponsibleId);
          return {
            id: `history:${h.id}`,
            kind: "lead_assigned",
            occurredAt: h.createdAt,
            actor,
            source: "history",
            metadata: {
              ...meta,
              responsibleName: newOne?.name ?? null,
              responsibleImage: newOne?.image ?? null,
            },
          };
        }
        if (h.eventType === "FORM_SUBMITTED") {
          return {
            id: `history:${h.id}`,
            kind: "form_submit",
            occurredAt: h.createdAt,
            actor,
            source: "history",
            metadata: {
              ...meta,
              formName:
                typeof meta.formId === "string" ? formName(meta.formId) : null,
            },
          };
        }
        if (h.eventType === "TAG_ADDED" || h.eventType === "TAG_REMOVED") {
          const tagId = typeof meta.tagId === "string" ? meta.tagId : null;
          const tag = tagInfo(tagId);
          return {
            id: `history:${h.id}`,
            kind: h.eventType === "TAG_ADDED" ? "tag_added" : "tag_removed",
            occurredAt: h.createdAt,
            actor,
            source: "history",
            metadata: {
              ...meta,
              tagName: tag?.name ?? null,
              tagColor: tag?.color ?? null,
            },
          };
        }
        if (h.eventType === "FILE_UPLOADED") {
          return {
            id: `history:${h.id}`,
            kind: "file_uploaded",
            occurredAt: h.createdAt,
            actor,
            source: "history",
            metadata: meta,
          };
        }
        if (h.eventType === "NOTE") {
          return {
            id: `history:${h.id}`,
            kind: "note",
            occurredAt: h.createdAt,
            actor,
            source: "history",
            metadata: { ...meta, notes: h.notes },
          };
        }
        if (h.eventType === "SLA_BREACHED") {
          return {
            id: `history:${h.id}`,
            kind: "sla_breached",
            occurredAt: h.createdAt,
            actor,
            source: "history",
            metadata: meta,
          };
        }
        if (h.eventType === "PUBLIC_LINK_VIEWED") {
          return {
            id: `history:${h.id}`,
            kind: "public_link_viewed",
            occurredAt: h.createdAt,
            actor: null,
            source: "history",
            metadata: meta,
          };
        }

        // Sem eventType — só action terminais aparecem.
        if (h.action === "WON") {
          return {
            id: `history:${h.id}`,
            kind: "won",
            occurredAt: h.createdAt,
            actor,
            source: "history",
            metadata: meta,
          };
        }
        if (h.action === "LOST") {
          return {
            id: `history:${h.id}`,
            kind: "lost",
            occurredAt: h.createdAt,
            actor,
            source: "history",
            metadata: meta,
          };
        }
        if (h.action === "DELETED") {
          return {
            id: `history:${h.id}`,
            kind: "deleted",
            occurredAt: h.createdAt,
            actor,
            source: "history",
            metadata: meta,
          };
        }
        // ACTIVE sem eventType = ruído. Filtra.
        return null;
      })
      .filter((e): e is TimelineEntry => e !== null);

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

    // Merge + ordena desc + dedupe (journey_event tem prioridade quando
    // kind+occurredAt batem com history). Dedup por (kind, segundo) —
    // se o mesmo evento foi gravado nas duas tabelas pelo mesmo procedure,
    // mantém a versão mais rica em metadata (geralmente journey_event).
    const all: TimelineEntry[] = [
      ...fromJourney,
      ...fromHistory,
      ...fromMessages,
      ...fromAppointments,
      ...fromForms,
      ...fromLinnker,
    ];

    const dedupKey = (e: TimelineEntry) =>
      `${e.kind}|${Math.floor(e.occurredAt.getTime() / 1000)}`;
    const seen = new Map<string, TimelineEntry>();
    for (const e of all) {
      const key = dedupKey(e);
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, e);
        continue;
      }
      // Prefere journey_event (metadata mais rica) sobre history.
      const score = (s: TimelineEntry["source"]) =>
        s === "journey_event" ? 3 : s === "history" ? 2 : 1;
      if (score(e.source) > score(existing.source)) {
        seen.set(key, e);
      }
    }

    const merged = Array.from(seen.values());
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
