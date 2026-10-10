import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { applyTagsByAi } from "@/features/tracking-chat-ai/lib/apply-tags-by-ai";
import { publishLeadChanged } from "@/features/leads/realtime/publish";
import { AUTO_TAG_SLUGS, type AutoTagKey } from "./default-org-template";

// Tags automáticas da empresa (spec 0042, RF-3 a RF-7). Só atuam se a empresa tem
// a tag padrão ativa: empresas antigas (sem ela) e tags arquivadas ficam de fora.

export const AWAIT_REPLY_CHECK_EVENT = "org-defaults/await-reply.check";
export const AWAIT_REPLY_DELAY_MINUTES = 15;

export type InboundChannel = "WHATSAPP" | "IN_CHAT" | "ASTRO_CHAT" | "INSTAGRAM" | "FACEBOOK";

const CHANNEL_TAG: Record<InboundChannel, AutoTagKey | null> = {
  WHATSAPP: "whatsapp",
  IN_CHAT: "siteChat",
  ASTRO_CHAT: "siteChat",
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
};

async function findActiveAutoTags(organizationId: string, keys: AutoTagKey[]) {
  const slugs = keys.map((key) => AUTO_TAG_SLUGS[key]);
  const tags = await prisma.tag.findMany({
    where: { organizationId, trackingId: null, slug: { in: slugs }, archivedAt: null },
    select: { id: true, slug: true },
  });
  return new Map(tags.map((tag) => [tag.slug, tag.id]));
}

// Tag já no lead não é reaplicada: applyTagsByAi redispara os gatilhos LEAD_TAGGED a cada chamada.
async function addMissingTags(leadId: string, tagIds: string[]) {
  if (tagIds.length === 0) return;
  const existing = await prisma.leadTag.findMany({ where: { leadId, tagId: { in: tagIds } }, select: { tagId: true } });
  const existingIds = new Set(existing.map((leadTag) => leadTag.tagId));
  const missing = tagIds.filter((tagId) => !existingIds.has(tagId));
  if (missing.length > 0) await applyTagsByAi({ leadId, tagIds: missing });
}

const NEW_LEAD_WINDOW_MS = 10 * 60_000;
const PAID_UTM_MEDIUM = /^(cpc|ppc|cpm|cpa|paid|paid[-_ ]?social|ads?|display)$/i;

function isNewLead(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() <= NEW_LEAD_WINDOW_MS;
}

/** Anúncio que abre o WhatsApp (dados do anúncio da Meta) ou link com UTM de mídia paga. */
function cameFromPaidTraffic(lead: { ctwaClid: string | null; metaAdId: string | null; utmMedium: string | null }): boolean {
  return Boolean(lead.ctwaClid || lead.metaAdId || (lead.utmMedium && PAID_UTM_MEDIUM.test(lead.utmMedium.trim())));
}

/** Estado antes da mensagem: define se o cliente já estava esperando resposta. */
export async function loadAwaitingState(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { lastInboundAt: true, lastOutboundAt: true },
  });
  const isAwaitingReply = Boolean(
    lead?.lastInboundAt && (!lead.lastOutboundAt || lead.lastOutboundAt < lead.lastInboundAt),
  );
  return { isAwaitingReply };
}

/** Mensagem do cliente: canal + "Em atendimento"; nova mensagem sem resposta → "Aguard. atendimento". */
export async function applyInboundAutoTags(params: {
  organizationId: string;
  leadId: string;
  channel: InboundChannel;
  wasAwaitingReply: boolean;
}) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: { source: true, createdAt: true, ctwaClid: true, metaAdId: true, utmMedium: true },
  });
  const channelKey = lead?.source === "NERP_CATALOG" ? "catalog" : CHANNEL_TAG[params.channel];
  // Origem (spec 0085): só na chegada do lead, para não remarcar cliente antigo a cada mensagem.
  const originKeys: AutoTagKey[] =
    lead && isNewLead(lead.createdAt) ? ["newLead", ...(cameFromPaidTraffic(lead) ? (["paidTraffic"] as const) : [])] : [];
  const keys: AutoTagKey[] = ["inService", "awaitingReply", ...(channelKey ? [channelKey] : []), ...originKeys];
  const tagIdBySlug = await findActiveAutoTags(params.organizationId, keys);
  if (tagIdBySlug.size === 0) return;

  const awaitingTagId = tagIdBySlug.get(AUTO_TAG_SLUGS.awaitingReply);
  const tagIdsToAdd = [...tagIdBySlug.entries()]
    .filter(([slug]) => slug !== AUTO_TAG_SLUGS.awaitingReply || params.wasAwaitingReply)
    .map(([, tagId]) => tagId);
  await addMissingTags(params.leadId, tagIdsToAdd);

  if (awaitingTagId && !params.wasAwaitingReply) {
    await inngest.send({
      name: AWAIT_REPLY_CHECK_EVENT,
      data: { organizationId: params.organizationId, leadId: params.leadId, inboundAt: new Date().toISOString() },
    });
  }
}

/** 15 min depois: ainda sem resposta desde a mensagem → "Aguard. atendimento" (RF-4). */
export async function applyAwaitingTagIfStillUnanswered(params: {
  organizationId: string;
  leadId: string;
  inboundAt: string;
}) {
  const lead = await prisma.lead.findUnique({ where: { id: params.leadId }, select: { lastOutboundAt: true } });
  if (!lead) return { applied: false };
  if (lead.lastOutboundAt && lead.lastOutboundAt >= new Date(params.inboundAt)) return { applied: false };
  const tagIdBySlug = await findActiveAutoTags(params.organizationId, ["awaitingReply"]);
  const tagId = tagIdBySlug.get(AUTO_TAG_SLUGS.awaitingReply);
  if (!tagId) return { applied: false };
  await addMissingTags(params.leadId, [tagId]);
  return { applied: true };
}

/** Resposta do atendente tira "Aguard. atendimento" (RF-5). */
export async function removeAwaitingTagOnReply(params: { organizationId: string; leadId: string }) {
  const tagIdBySlug = await findActiveAutoTags(params.organizationId, ["awaitingReply"]);
  const tagId = tagIdBySlug.get(AUTO_TAG_SLUGS.awaitingReply);
  if (!tagId) return;
  const removed = await prisma.leadTag.deleteMany({ where: { leadId: params.leadId, tagId } });
  if (removed.count === 0) return;
  const lead = await prisma.lead.findUnique({ where: { id: params.leadId }, select: { trackingId: true, statusId: true } });
  if (lead) {
    await publishLeadChanged({ leadId: params.leadId, trackingId: lead.trackingId, statusId: lead.statusId, fields: ["tag"] });
  }
}
