import prisma from "@/lib/prisma";

/**
 * Linha do tempo PÚBLICA do lead — mostrada em `/lead/<token>` pra que o
 * cliente acompanhe o que aconteceu com o atendimento dele em tempo real.
 *
 * Une as DUAS tabelas de histórico do projeto:
 *   - `LeadHistory` (legado) — gravado por procedures antigas (create-lead,
 *     update-action, create-file, etc.) via `recordLeadHistory`.
 *   - `LeadJourneyEvent` (unificado) — gravado por features novas (form,
 *     SLA, journey) via `recordLeadEvent` → `trackLeadEvent`.
 *
 * Resolve IDs em nomes legíveis (status anterior/novo, responsável, form,
 * tag, etc.) com queries em batch — para que o cliente final NÃO veja
 * "Atualização registrada" sem detalhes; em vez disso vê: "Mudou de etapa:
 * 'Em diagnóstico' → 'Em conserto' • por João Silva".
 */

export type PublicTimelineEntry = {
  id: string;
  at: string; // ISO
  source: "history" | "journey";
  /**
   * Tipo do evento normalizado pra UI. Mapeia tanto `LeadEventType` (do
   * LeadHistory) quanto `kind` string (do LeadJourneyEvent).
   */
  kind:
    | "status_change"
    | "tracking_change"
    | "responsible_change"
    | "form_submitted"
    | "file_uploaded"
    | "tag_added"
    | "tag_removed"
    | "note"
    | "sla_breached"
    | "public_link_viewed"
    | "won"
    | "lost"
    | "deleted"
    | "active"
    | "appointment"
    | "message"
    | "other";
  // Quem fez a ação. Null pra eventos automáticos (ex.: SLA, abertura
  // do link público pelo próprio cliente).
  actor?: { name?: string | null; image?: string | null } | null;
  // Texto principal e detalhes.
  title: string;
  details?: string | null;
  // Cores/refs opcionais — usadas pelo frontend pra desenhar badges.
  fromColor?: string | null;
  toColor?: string | null;
  rawMetadata?: Record<string, unknown>;
};

type RawLeadHistory = {
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
};

type RawJourneyEvent = {
  id: string;
  occurredAt: Date;
  kind: string;
  metadata: unknown;
  actorId: string | null;
};

type StatusRef = { id: string; name: string; color: string | null };
type TrackingRef = { id: string; name: string };
type UserRef = { id: string; name: string | null; image: string | null };
type FormRef = { id: string; name: string };
type TagRef = { id: string; name: string; color: string | null };

/**
 * Busca o histórico das duas tabelas, resolve IDs → nomes em batch e
 * devolve uma timeline ordenada por data crescente.
 */
export async function resolvePublicTimeline(
  leadId: string,
  limit = 100,
): Promise<PublicTimelineEntry[]> {
  const [historyRows, journeyRows] = await Promise.all([
    (prisma.leadHistory.findMany as (args: unknown) => Promise<RawLeadHistory[]>)({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      take: limit,
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
      },
    }),
    (prisma.leadJourneyEvent.findMany as (args: unknown) => Promise<RawJourneyEvent[]>)({
      where: { leadId },
      orderBy: { occurredAt: "desc" },
      take: limit,
      select: {
        id: true,
        occurredAt: true,
        kind: true,
        metadata: true,
        actorId: true,
      },
    }),
  ]);

  // ── Coleta IDs pra resolver em batch ─────────────────────────────────
  const statusIds = new Set<string>();
  const trackingIds = new Set<string>();
  const userIds = new Set<string>();
  const formIds = new Set<string>();
  const tagIds = new Set<string>();

  for (const h of historyRows) {
    if (h.previousStatusId) statusIds.add(h.previousStatusId);
    if (h.newStatusId) statusIds.add(h.newStatusId);
    if (h.previousTrackingId) trackingIds.add(h.previousTrackingId);
    if (h.newTrackingId) trackingIds.add(h.newTrackingId);
    if (h.previousResponsibleId) userIds.add(h.previousResponsibleId);
    if (h.newResponsibleId) userIds.add(h.newResponsibleId);
    if (h.userId) userIds.add(h.userId);
    const meta = (h.metadata ?? {}) as Record<string, unknown>;
    if (typeof meta.formId === "string") formIds.add(meta.formId);
    if (typeof meta.tagId === "string") tagIds.add(meta.tagId);
  }
  for (const j of journeyRows) {
    const meta = (j.metadata ?? {}) as Record<string, unknown>;
    if (j.actorId) userIds.add(j.actorId);
    if (typeof meta.previousStatusId === "string") statusIds.add(meta.previousStatusId);
    if (typeof meta.newStatusId === "string") statusIds.add(meta.newStatusId);
    if (typeof meta.previousTrackingId === "string") trackingIds.add(meta.previousTrackingId);
    if (typeof meta.newTrackingId === "string") trackingIds.add(meta.newTrackingId);
    if (typeof meta.previousResponsibleId === "string") userIds.add(meta.previousResponsibleId);
    if (typeof meta.newResponsibleId === "string") userIds.add(meta.newResponsibleId);
    if (typeof meta.formId === "string") formIds.add(meta.formId);
    if (typeof meta.tagId === "string") tagIds.add(meta.tagId);
  }

  // ── Resolve IDs em batch ─────────────────────────────────────────────
  const [statuses, trackings, users, forms, tags] = await Promise.all([
    statusIds.size > 0
      ? prisma.status.findMany({
          where: { id: { in: Array.from(statusIds) } },
          select: { id: true, name: true, color: true },
        })
      : Promise.resolve<StatusRef[]>([]),
    trackingIds.size > 0
      ? prisma.tracking.findMany({
          where: { id: { in: Array.from(trackingIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve<TrackingRef[]>([]),
    userIds.size > 0
      ? prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, name: true, image: true },
        })
      : Promise.resolve<UserRef[]>([]),
    formIds.size > 0
      ? prisma.form.findMany({
          where: { id: { in: Array.from(formIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve<FormRef[]>([]),
    tagIds.size > 0
      ? prisma.tag.findMany({
          where: { id: { in: Array.from(tagIds) } },
          select: { id: true, name: true, color: true },
        })
      : Promise.resolve<TagRef[]>([]),
  ]);

  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const trackingById = new Map(trackings.map((t) => [t.id, t]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const formById = new Map(forms.map((f) => [f.id, f]));
  const tagById = new Map(tags.map((t) => [t.id, t]));

  // ── Helpers de mapeamento ────────────────────────────────────────────
  function statusName(id?: string | null) {
    if (!id) return null;
    return statusById.get(id)?.name ?? null;
  }
  function statusColor(id?: string | null) {
    if (!id) return null;
    return statusById.get(id)?.color ?? null;
  }
  function trackingName(id?: string | null) {
    if (!id) return null;
    return trackingById.get(id)?.name ?? null;
  }
  function userObj(id?: string | null) {
    if (!id) return null;
    const u = userById.get(id);
    if (!u) return null;
    return { name: u.name, image: u.image };
  }
  function formName(id?: string | null) {
    if (!id) return null;
    return formById.get(id)?.name ?? null;
  }
  function tagInfo(id?: string | null) {
    if (!id) return null;
    return tagById.get(id) ?? null;
  }

  // ── Converte LeadHistory rows ────────────────────────────────────────
  const fromHistory: PublicTimelineEntry[] = historyRows.map((h) => {
    const meta = (h.metadata ?? {}) as Record<string, unknown>;
    const base: PublicTimelineEntry = {
      id: `h-${h.id}`,
      at: h.createdAt.toISOString(),
      source: "history",
      kind: "other",
      title: "Atualização registrada",
      actor: userObj(h.userId),
      rawMetadata: meta,
    };

    // Prioriza eventType explícito; se nulo, usa `action` legado.
    const t = h.eventType ?? null;

    if (t === "STATUS_CHANGE") {
      const fromName = statusName(h.previousStatusId);
      const toName = statusName(h.newStatusId);
      return {
        ...base,
        kind: "status_change",
        title: "Mudou de etapa",
        details:
          fromName && toName
            ? `${fromName} → ${toName}`
            : (toName ?? fromName ?? null),
        fromColor: statusColor(h.previousStatusId),
        toColor: statusColor(h.newStatusId),
      };
    }
    if (t === "TRACKING_CHANGE") {
      const fromName = trackingName(h.previousTrackingId);
      const toName = trackingName(h.newTrackingId);
      return {
        ...base,
        kind: "tracking_change",
        title: "Mudou de setor",
        details:
          fromName && toName
            ? `${fromName} → ${toName}`
            : (toName ?? fromName ?? null),
      };
    }
    if (t === "RESPONSIBLE_CHANGE") {
      const newOne = userObj(h.newResponsibleId);
      return {
        ...base,
        kind: "responsible_change",
        title: "Novo responsável",
        details: newOne?.name ?? "—",
      };
    }
    if (t === "FORM_SUBMITTED") {
      const fId = typeof meta.formId === "string" ? meta.formId : null;
      const edited = meta.edited === true;
      return {
        ...base,
        kind: "form_submitted",
        title: edited ? "Formulário atualizado" : "Formulário recebido",
        details: formName(fId),
      };
    }
    if (t === "TAG_ADDED") {
      const tId = typeof meta.tagId === "string" ? meta.tagId : null;
      const tag = tagInfo(tId);
      return {
        ...base,
        kind: "tag_added",
        title: "Tag aplicada",
        details: tag?.name ?? null,
        toColor: tag?.color ?? null,
      };
    }
    if (t === "TAG_REMOVED") {
      const tId = typeof meta.tagId === "string" ? meta.tagId : null;
      const tag = tagInfo(tId);
      return {
        ...base,
        kind: "tag_removed",
        title: "Tag removida",
        details: tag?.name ?? null,
        fromColor: tag?.color ?? null,
      };
    }
    if (t === "FILE_UPLOADED") {
      const fileName =
        typeof meta.fileName === "string" ? meta.fileName : null;
      return {
        ...base,
        kind: "file_uploaded",
        title: "Arquivo enviado",
        details: fileName,
      };
    }
    if (t === "NOTE") {
      return {
        ...base,
        kind: "note",
        title: "Nota adicionada",
        details: h.notes ?? null,
      };
    }
    if (t === "SLA_BREACHED") {
      return { ...base, kind: "sla_breached", title: "Prazo excedido" };
    }
    if (t === "PUBLIC_LINK_VIEWED") {
      return {
        ...base,
        kind: "public_link_viewed",
        title: "Você abriu o acompanhamento",
      };
    }

    // Sem eventType — mapeia pelo `action` legado (WON/LOST/DELETED).
    // ACTIVE sem eventType é NOISE (várias procedures gravam um
    // `recordLeadHistory({ action: ACTIVE })` como side-effect de outras
    // ações — ex.: ao mover lead no kanban). Esses registros não trazem
    // informação útil pro cliente; são apenas marcadores internos. O
    // evento "real" (status_change, etc.) virá pelo LeadJourneyEvent
    // graças ao `recordLeadEvent`. Marcamos como `__skip` pra filtrar.
    if (h.action === "WON") {
      return { ...base, kind: "won", title: "Negócio ganho" };
    }
    if (h.action === "LOST") {
      return { ...base, kind: "lost", title: "Negócio perdido" };
    }
    if (h.action === "DELETED") {
      return { ...base, kind: "deleted", title: "Lead arquivado" };
    }
    if (h.action === "ACTIVE") {
      return { ...base, kind: "__skip" as PublicTimelineEntry["kind"], title: "" };
    }
    return base;
  }).filter((e) => e.kind !== ("__skip" as PublicTimelineEntry["kind"]));

  // ── Converte LeadJourneyEvent rows ───────────────────────────────────
  const fromJourney: PublicTimelineEntry[] = journeyRows.map((j) => {
    const meta = (j.metadata ?? {}) as Record<string, unknown>;
    const base: PublicTimelineEntry = {
      id: `j-${j.id}`,
      at: j.occurredAt.toISOString(),
      source: "journey",
      kind: "other",
      title: "Atualização registrada",
      actor: userObj(j.actorId),
      rawMetadata: meta,
    };

    if (j.kind === "status_changed") {
      const prevId =
        typeof meta.previousStatusId === "string"
          ? meta.previousStatusId
          : null;
      const newId =
        typeof meta.newStatusId === "string" ? meta.newStatusId : null;
      const fromName = statusName(prevId);
      const toName = statusName(newId);
      return {
        ...base,
        kind: "status_change",
        title: "Mudou de etapa",
        details:
          fromName && toName
            ? `${fromName} → ${toName}`
            : (toName ?? fromName ?? null),
        fromColor: statusColor(prevId),
        toColor: statusColor(newId),
      };
    }
    if (j.kind === "form_submit") {
      const fId = typeof meta.formId === "string" ? meta.formId : null;
      const returning = meta.returning === true;
      const edited = meta.edited === true;
      return {
        ...base,
        kind: "form_submitted",
        title: edited
          ? "Formulário atualizado"
          : returning
            ? "Resposta de formulário recebida"
            : "Formulário recebido",
        details: formName(fId),
      };
    }
    if (j.kind === "lead_assigned") {
      const newId =
        typeof meta.newResponsibleId === "string"
          ? meta.newResponsibleId
          : null;
      const newOne = userObj(newId);
      return {
        ...base,
        kind: "responsible_change",
        title: "Novo responsável",
        details: newOne?.name ?? "—",
      };
    }
    if (j.kind === "tag_added") {
      const tId = typeof meta.tagId === "string" ? meta.tagId : null;
      const tag = tagInfo(tId);
      return {
        ...base,
        kind: "tag_added",
        title: "Tag aplicada",
        details: tag?.name ?? null,
        toColor: tag?.color ?? null,
      };
    }
    if (j.kind === "won") return { ...base, kind: "won", title: "Negócio ganho" };
    if (j.kind === "lost") return { ...base, kind: "lost", title: "Negócio perdido" };
    if (
      j.kind === "appointment_created" ||
      j.kind === "appointment_done" ||
      j.kind === "appointment_no_show"
    ) {
      const titles: Record<string, string> = {
        appointment_created: "Agendamento criado",
        appointment_done: "Agendamento concluído",
        appointment_no_show: "Agendamento sem comparecimento",
      };
      return { ...base, kind: "appointment", title: titles[j.kind] ?? "Agendamento" };
    }
    if (j.kind === "message_in") {
      return { ...base, kind: "message", title: "Mensagem recebida" };
    }
    if (j.kind === "message_out") {
      return { ...base, kind: "message", title: "Mensagem enviada" };
    }
    if (j.kind === "first_response") {
      return { ...base, kind: "message", title: "Primeira resposta dada" };
    }
    return base;
  });

  // ── Merge + dedupe (eventos espelhados nas duas tabelas com a mesma
  //    natureza no mesmo segundo são consolidados pra evitar duplicidade
  //    visual; mantemos o do journey por ter mais metadata).
  const merged = [...fromJourney, ...fromHistory];

  const dedupKey = (e: PublicTimelineEntry) =>
    `${e.kind}|${e.title}|${e.details ?? ""}|${Math.floor(
      new Date(e.at).getTime() / 1000,
    )}`;
  const seen = new Map<string, PublicTimelineEntry>();
  for (const e of merged) {
    const key = dedupKey(e);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, e);
      continue;
    }
    // Prefere a entrada vinda de journey (mais rica em metadata).
    if (existing.source !== "journey" && e.source === "journey") {
      seen.set(key, e);
    }
  }

  return Array.from(seen.values()).sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}
