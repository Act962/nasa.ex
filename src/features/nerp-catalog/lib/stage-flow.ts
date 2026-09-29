import "server-only";
import prisma from "@/lib/prisma";
import { recordLeadEvent } from "@/features/leads/lib/history";
import { publishLeadChanged } from "@/features/leads/realtime/publish";
import { nerpPublicOrigin } from "@/features/nerp/lib/oauth";
import { buildOrderPortalUrl, formatBrl } from "../utils/format-order";
import type { CatalogOrderDelivery } from "../schemas/order-payload";
import { sendOrderNotice } from "./order-channel";
import {
  CATALOG_NOTICE_KIND,
  CATALOG_STAGE_KEYS,
  CATALOG_STAGE_TAG_SLUGS,
  findCatalogStage,
  isCatalogStageKey,
  isPickupDelivery,
  catalogStageIndex,
  type CatalogStageKey,
} from "./catalog-stages";
import { moveLeadToStage } from "@/features/leads/lib/move-lead";

// Lead entrou numa coluna com chave de catálogo (spec 0044): troca a tag de etapa,
// atualiza o pedido e avisa o cliente. Chamado depois do commit, best-effort (Regra 18).

export type CatalogNoticeType = "payment_confirmed" | "star_earned" | "sent_to_separation" | "out_for_delivery" | "ready_for_pickup";

type NoticeContent = { title: string; subtitle: string; whatsappText: string };

async function applyStageTag(params: { leadId: string; organizationId: string; trackingId: string; statusId: string; stageKey: CatalogStageKey; actorUserId: string | null }) {
  const stage = findCatalogStage(params.stageKey);
  const stageTags = await prisma.tag.findMany({
    where: { organizationId: params.organizationId, trackingId: params.trackingId, slug: { in: CATALOG_STAGE_TAG_SLUGS }, archivedAt: null },
    select: { id: true, slug: true, name: true, color: true },
  });
  let targetTag = stageTags.find((tag) => tag.slug === stage.tagSlug);
  if (!targetTag) {
    targetTag = await prisma.tag.create({
      data: { name: stage.name, slug: stage.tagSlug, color: stage.tagColor, type: "SYSTEM", organizationId: params.organizationId, trackingId: params.trackingId },
      select: { id: true, slug: true, name: true, color: true },
    });
    stageTags.push(targetTag);
  }

  const currentLeadTags = await prisma.leadTag.findMany({
    where: { leadId: params.leadId, tagId: { in: stageTags.map((tag) => tag.id) } },
    select: { tagId: true },
  });
  const staleTags = stageTags.filter((tag) => tag.id !== targetTag.id && currentLeadTags.some((leadTag) => leadTag.tagId === tag.id));
  const hasTarget = currentLeadTags.some((leadTag) => leadTag.tagId === targetTag.id);
  if (staleTags.length === 0 && hasTarget) return;

  if (staleTags.length > 0) {
    await prisma.leadTag.deleteMany({ where: { leadId: params.leadId, tagId: { in: staleTags.map((tag) => tag.id) } } });
  }
  if (!hasTarget) {
    await prisma.leadTag.createMany({ data: [{ leadId: params.leadId, tagId: targetTag.id }], skipDuplicates: true });
  }

  for (const tag of staleTags) {
    await recordLeadEvent({
      leadId: params.leadId,
      eventType: "TAG_REMOVED",
      userId: params.actorUserId,
      metadata: { tagId: tag.id, tagName: tag.name, tagColor: tag.color, source: "catalog_stage" },
    });
  }
  if (!hasTarget) {
    await recordLeadEvent({
      leadId: params.leadId,
      eventType: "TAG_ADDED",
      userId: params.actorUserId,
      metadata: { tagId: targetTag.id, tagName: targetTag.name, tagColor: targetTag.color, source: "catalog_stage" },
    });
  }
  await publishLeadChanged({ leadId: params.leadId, trackingId: params.trackingId, statusId: params.statusId, fields: ["tag"] });
}

// Um aviso por pedido e tipo: arrastar o card de volta e para frente não repete a mensagem (CB-1).
async function sendNoticeOnce(params: { conversationId: string; catalogOrderId: string; noticeType: CatalogNoticeType; content: NoticeContent }) {
  const noticeKey = `${params.catalogOrderId}:${params.noticeType}`;
  const alreadySent = await prisma.message.findFirst({
    where: { conversationId: params.conversationId, metadata: { path: ["noticeKey"], equals: noticeKey } },
    select: { id: true },
  });
  if (alreadySent) return;
  await sendOrderNotice({
    conversationId: params.conversationId,
    text: params.content.whatsappText,
    metadata: {
      kind: CATALOG_NOTICE_KIND,
      noticeKey,
      noticeType: params.noticeType,
      title: params.content.title,
      subtitle: params.content.subtitle,
      catalogOrderId: params.catalogOrderId,
    },
  });
}

function buildNotices(params: { stageKey: CatalogStageKey; saleNumber: number; total: number; portalUrl: string; starsEarned: number; isPickup: boolean }) {
  const notices: { type: CatalogNoticeType; content: NoticeContent }[] = [];
  if (params.stageKey === CATALOG_STAGE_KEYS.paid) {
    notices.push({
      type: "payment_confirmed",
      content: {
        title: "Pagamento confirmado",
        subtitle: `Recebemos seu pagamento de ${formatBrl(params.total)}`,
        whatsappText: `✅ Pagamento confirmado! Recebemos ${formatBrl(params.total)} do pedido #${params.saleNumber}.`,
      },
    });
    if (params.starsEarned > 0) {
      const starLabel = params.starsEarned === 1 ? "1 star" : `${params.starsEarned} stars`;
      notices.push({
        type: "star_earned",
        content: {
          title: `Você ganhou ${starLabel}!`,
          subtitle: "Acompanhe suas Stars e troque em brindes",
          whatsappText: `⭐ Você ganhou ${starLabel}! Acompanhe suas Stars e troque em brindes: ${params.portalUrl}`,
        },
      });
    }
    notices.push({
      type: "sent_to_separation",
      content: {
        title: "Pedido enviado para separação",
        subtitle: "A loja já está preparando seus itens",
        whatsappText: `📦 Pedido #${params.saleNumber} enviado para separação. Acompanhe por aqui: ${params.portalUrl}`,
      },
    });
  }
  if (params.stageKey === CATALOG_STAGE_KEYS.separated) {
    notices.push(
      params.isPickup
        ? {
            type: "ready_for_pickup",
            content: {
              title: "Pedido separado e pronto para você recolher",
              subtitle: "Retire na loja quando quiser",
              whatsappText: `🛍️ Pedido #${params.saleNumber} separado e pronto para você recolher na loja.`,
            },
          }
        : {
            type: "out_for_delivery",
            content: {
              title: "Pedido em rota de entrega",
              subtitle: "Chega em breve no endereço informado",
              whatsappText: `🛵 Pedido #${params.saleNumber} em rota de entrega. Acompanhe por aqui: ${params.portalUrl}`,
            },
          },
    );
  }
  return notices;
}

export async function handleCatalogStageEntry(params: { leadId: string; statusId: string; actorUserId?: string | null }) {
  const status = await prisma.status.findUnique({
    where: { id: params.statusId },
    select: { systemKey: true, trackingId: true, tracking: { select: { organizationId: true } } },
  });
  if (!status || !isCatalogStageKey(status.systemKey)) return;
  const stageKey = status.systemKey;

  await applyStageTag({
    leadId: params.leadId,
    organizationId: status.tracking.organizationId,
    trackingId: status.trackingId,
    statusId: params.statusId,
    stageKey,
    actorUserId: params.actorUserId ?? null,
  });

  const order = await prisma.catalogOrder.findFirst({
    where: { leadId: params.leadId, status: { not: "CANCELED" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, nerpSaleNumber: true, total: true, publicToken: true, delivery: true, lead: { select: { conversation: { select: { id: true } } } } },
  });
  if (!order) return;

  if (stageKey === CATALOG_STAGE_KEYS.separated && order.status === "PAID") {
    await prisma.catalogOrder.update({ where: { id: order.id }, data: { status: "IN_LOGISTICS" } });
  }
  if (stageKey === CATALOG_STAGE_KEYS.delivered && (order.status === "PAID" || order.status === "IN_LOGISTICS")) {
    await prisma.catalogOrder.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
  }

  const conversationId = order.lead.conversation?.id;
  const isPaidOrLater = ["PAID", "IN_LOGISTICS", "DELIVERED"].includes(order.status);
  if (!conversationId || !isPaidOrLater) return;

  const earnedEntry = await prisma.loyaltyLedgerEntry.findFirst({
    where: { source: "CATALOG_ORDER", sourceId: order.id, type: "EARN" },
    select: { stars: true },
  });
  const notices = buildNotices({
    stageKey,
    saleNumber: order.nerpSaleNumber,
    total: Number(order.total),
    portalUrl: buildOrderPortalUrl(nerpPublicOrigin(), order.publicToken),
    starsEarned: earnedEntry?.stars ?? 0,
    isPickup: isPickupDelivery((order.delivery as CatalogOrderDelivery | null)?.method),
  });
  for (const notice of notices) {
    await sendNoticeOnce({ conversationId, catalogOrderId: order.id, noticeType: notice.type, content: notice.content }).catch((error) =>
      console.error(`[nerp-catalog/stage] notice ${notice.type} failed`, error),
    );
  }
}

/** Avança o lead do pedido para uma etapa do mesmo tracking, só para frente (ex.: gerou PIX → Confirmado). */
export async function advanceCatalogLeadToStage(params: { leadId: string; stageKey: CatalogStageKey }) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: { trackingId: true, status: { select: { systemKey: true } } },
  });
  if (!lead || !isCatalogStageKey(lead.status.systemKey)) return;
  if (catalogStageIndex(lead.status.systemKey) >= catalogStageIndex(params.stageKey)) return;
  const target = await prisma.status.findUnique({
    where: { trackingId_systemKey: { trackingId: lead.trackingId, systemKey: params.stageKey } },
    select: { id: true },
  });
  if (!target) return;
  await moveLeadToStage({ leadId: params.leadId, toTrackingId: lead.trackingId, toStatusId: target.id });
}
