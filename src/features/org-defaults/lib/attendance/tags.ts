import "server-only";
import prisma from "@/lib/prisma";
import { applyTagsByAi } from "@/features/tracking-chat-ai/lib/apply-tags-by-ai";
import { publishLeadChanged } from "@/features/leads/realtime/publish";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { AUTO_TAG_SLUGS, DEFAULT_TAGS, type AutoTagKey } from "../default-org-template";

// Etiquetas de sistema do atendimento (spec 0113). Empresa antiga ganha a etiqueta na hora em que precisa;
// etiqueta arquivada pela empresa desliga só a etiqueta (o estado do lead continua valendo).

export type AttendanceStatusFlow = "NEW" | "WAITING" | "ACTIVE" | "FINISHED";

const STATUS_FLOW_TAG: Record<AttendanceStatusFlow, AutoTagKey | null> = {
  NEW: null,
  WAITING: "awaitingReply",
  ACTIVE: "inService",
  FINISHED: "finished",
};
const STATE_TAG_KEYS: AutoTagKey[] = ["awaitingReply", "inService", "finished"];

/** Id da etiqueta de sistema; `null` quando a empresa arquivou. */
export async function ensureSystemTagId(organizationId: string, key: AutoTagKey): Promise<string | null> {
  const template = DEFAULT_TAGS.find((tag) => tag.key === key);
  const slug = AUTO_TAG_SLUGS[key];
  const existing = await prisma.tag.findFirst({
    where: {
      organizationId,
      trackingId: null,
      OR: [{ slug }, ...(template ? [{ name: template.name }] : [])],
    },
    orderBy: { archivedAt: { sort: "desc", nulls: "first" } },
    select: { id: true, archivedAt: true },
  });
  if (existing) return existing.archivedAt ? null : existing.id;
  if (!template) return null;
  const created = await prisma.tag
    .create({
      data: {
        name: template.name,
        slug,
        color: template.color,
        description: template.description,
        type: "SYSTEM",
        organizationId,
      },
      select: { id: true },
    })
    .catch(() => null);
  if (created) return created.id;
  // Corrida com outra mensagem do mesmo lead: a outra criou primeiro.
  const createdMeanwhile = await prisma.tag.findFirst({
    where: { organizationId, trackingId: null, slug, archivedAt: null },
    select: { id: true },
  });
  return createdMeanwhile?.id ?? null;
}

async function publishTagChange(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { trackingId: true, statusId: true } });
  if (lead) await publishLeadChanged({ leadId, trackingId: lead.trackingId, statusId: lead.statusId, fields: ["tag"] });
}

/**
 * Espelha o `statusFlow` nas etiquetas de tempo real: fica só a do estado atual ("Aguard. atendimento",
 * "Em atendimento" ou "Finalizado"). Sem histórico na Jornada, por decisão (são de tempo real).
 */
export async function mirrorStatusFlowTags(params: {
  organizationId: string;
  leadId: string;
  statusFlow: AttendanceStatusFlow;
}): Promise<void> {
  const currentKey = STATUS_FLOW_TAG[params.statusFlow];
  const otherSlugs = STATE_TAG_KEYS.filter((key) => key !== currentKey).map((key) => AUTO_TAG_SLUGS[key]);
  const removed = await prisma.leadTag.deleteMany({
    where: { leadId: params.leadId, tag: { organizationId: params.organizationId, trackingId: null, slug: { in: otherSlugs } } },
  });

  const currentTagId = currentKey ? await ensureSystemTagId(params.organizationId, currentKey) : null;
  const isAlreadyTagged = currentTagId
    ? Boolean(await prisma.leadTag.findFirst({ where: { leadId: params.leadId, tagId: currentTagId }, select: { id: true } }))
    : true;
  // `applyTagsByAi` dispara os fluxos "Lead com Tag" da etiqueta nova.
  if (currentTagId && !isAlreadyTagged) await applyTagsByAi({ leadId: params.leadId, tagIds: [currentTagId] });
  if (removed.count > 0 && isAlreadyTagged) await publishTagChange(params.leadId);
}

export type HistoryTagReason = "booked" | "cancelled" | "expired" | "rescheduled" | "finished" | "no_show";

/** Etiqueta com histórico ("Agendado", "Cancelou"): cada entrada e saída vira evento na Jornada. */
export async function addHistoryTag(params: {
  organizationId: string;
  leadId: string;
  key: AutoTagKey;
  reason: HistoryTagReason;
  appointmentId?: string;
  sectionId?: string;
}): Promise<boolean> {
  const tagId = await ensureSystemTagId(params.organizationId, params.key);
  if (!tagId) return false;
  const existing = await prisma.leadTag.findFirst({ where: { leadId: params.leadId, tagId }, select: { id: true } });
  if (existing) return false;
  await applyTagsByAi({ leadId: params.leadId, tagIds: [tagId] });
  await trackLeadEvent({
    leadId: params.leadId,
    kind: "tag_added",
    metadata: { tagId, source: "attendance", reason: params.reason, appointmentId: params.appointmentId, sectionId: params.sectionId },
  });
  return true;
}

export async function removeHistoryTag(params: {
  organizationId: string;
  leadId: string;
  key: AutoTagKey;
  reason: HistoryTagReason;
  appointmentId?: string;
  sectionId?: string;
}): Promise<boolean> {
  const tag = await prisma.tag.findFirst({
    where: { organizationId: params.organizationId, trackingId: null, slug: AUTO_TAG_SLUGS[params.key] },
    select: { id: true },
  });
  if (!tag) return false;
  const removed = await prisma.leadTag.deleteMany({ where: { leadId: params.leadId, tagId: tag.id } });
  if (removed.count === 0) return false;
  await trackLeadEvent({
    leadId: params.leadId,
    kind: "tag_removed",
    metadata: { tagId: tag.id, source: "attendance", reason: params.reason, appointmentId: params.appointmentId, sectionId: params.sectionId },
  });
  await publishTagChange(params.leadId);
  return true;
}
