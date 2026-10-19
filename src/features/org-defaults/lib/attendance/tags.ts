import "server-only";
import prisma from "@/lib/prisma";
import { applyTagsByAi } from "@/features/tracking-chat-ai/lib/apply-tags-by-ai";
import { publishLeadChanged } from "@/features/leads/realtime/publish";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { ATTENDANCE_TAGS, AUTO_TAG_SLUGS, DEFAULT_TAGS, type AutoTagKey } from "../default-org-template";

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

/**
 * Etiquetas da empresa que fazem o papel de cada chave: a `SYSTEM` primeiro; sem ela, a da empresa com o mesmo
 * slug (contas antigas), para não criar uma segunda etiqueta com o mesmo nome. Inclui as arquivadas.
 */
async function findStateTags(organizationId: string, keys: AutoTagKey[]): Promise<Map<AutoTagKey, { id: string; isArchived: boolean }>> {
  const slugs = keys.map((key) => AUTO_TAG_SLUGS[key]);
  const tags = await prisma.tag.findMany({
    where: { organizationId, trackingId: null, slug: { in: slugs } },
    select: { id: true, slug: true, type: true, archivedAt: true },
  });
  const tagByKey = new Map<AutoTagKey, { id: string; isArchived: boolean }>();
  for (const key of keys) {
    const candidates = tags.filter((tag) => tag.slug === AUTO_TAG_SLUGS[key]);
    const chosen =
      candidates.find((tag) => tag.type === "SYSTEM" && !tag.archivedAt) ??
      candidates.find((tag) => tag.type === "SYSTEM") ??
      candidates.find((tag) => !tag.archivedAt) ??
      candidates[0];
    if (chosen) tagByKey.set(key, { id: chosen.id, isArchived: Boolean(chosen.archivedAt) });
  }
  return tagByKey;
}

/** Id da etiqueta do atendimento, criada na hora se a empresa não tem; `null` quando a empresa arquivou. */
export async function ensureSystemTagId(organizationId: string, key: AutoTagKey): Promise<string | null> {
  const existing = (await findStateTags(organizationId, [key])).get(key);
  if (existing) return existing.isArchived ? null : existing.id;
  const template = [...DEFAULT_TAGS, ...ATTENDANCE_TAGS].find((tag) => tag.key === key);
  if (!template) return null;
  const created = await prisma.tag
    .create({
      data: {
        name: template.name,
        slug: AUTO_TAG_SLUGS[key],
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
  const createdMeanwhile = (await findStateTags(organizationId, [key])).get(key);
  return createdMeanwhile && !createdMeanwhile.isArchived ? createdMeanwhile.id : null;
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
  const otherKeys = STATE_TAG_KEYS.filter((key) => key !== currentKey);
  const otherTagIds = [...(await findStateTags(params.organizationId, otherKeys)).values()].map((tag) => tag.id);
  const removed =
    otherTagIds.length > 0
      ? await prisma.leadTag.deleteMany({ where: { leadId: params.leadId, tagId: { in: otherTagIds } } })
      : { count: 0 };

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
  const tag = (await findStateTags(params.organizationId, [params.key])).get(params.key);
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
