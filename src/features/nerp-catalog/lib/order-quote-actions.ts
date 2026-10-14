import "server-only";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { applyTagsByAi } from "@/features/tracking-chat-ai/lib/apply-tags-by-ai";
import { signalLeadAwaitingHuman } from "@/features/tracking-chat-ai/lib/awaiting-human";
import type { CatalogOrderItem } from "../schemas/order-payload";
import { buildQuoteMessageText, toLeadAmountCents } from "../utils/format-order";
import { deliverTextToLead } from "./order-channel";
import { CATALOG_INTENT_TAGS, computeQuotedTotals, isAwaitingInternalApproval, type CatalogIntentTagKey, type QuoteInput } from "./order-quote";
import { hasActiveSalesApprovers } from "./approvals/order-approvals";

const QUOTABLE_STATUSES = ["RECEIVED", "NEGOTIATING"] as const;

export class CatalogQuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogQuoteError";
  }
}

async function ensureIntentTagId(organizationId: string, key: CatalogIntentTagKey): Promise<string> {
  const definition = CATALOG_INTENT_TAGS[key];
  const existing = await prisma.tag.findFirst({
    where: { organizationId, trackingId: null, slug: definition.slug },
    select: { id: true, archivedAt: true },
  });
  if (existing) {
    if (existing.archivedAt) {
      await prisma.tag.update({ where: { id: existing.id }, data: { archivedAt: null, archivedById: null } });
    }
    return existing.id;
  }
  const created = await prisma.tag.create({
    data: { ...definition, organizationId, trackingId: null },
    select: { id: true },
  });
  return created.id;
}

/** Best-effort: tag que não aplica não pode impedir o pedido de orçamento nem a aprovação. */
export async function applyCatalogIntentTag(params: { organizationId: string; leadId: string; key: CatalogIntentTagKey; shouldRetrigger?: boolean }) {
  try {
    const tagId = await ensureIntentTagId(params.organizationId, params.key);
    // Reaplicar dispara de novo o gatilho "Lead com tag" (valor reenviado reabre a aprovação, CB-4).
    if (params.shouldRetrigger) await prisma.leadTag.deleteMany({ where: { leadId: params.leadId, tagId } });
    await applyTagsByAi({ leadId: params.leadId, tagIds: [tagId] });
  } catch (tagError) {
    console.warn("[nerp-catalog/quote] tag de intenção falhou", tagError instanceof Error ? tagError.message : "erro");
  }
}

// Spec 0103, RF-2: avisa a equipe sem pausar a IA (D-2).
export async function requestOrderQuote(params: { orderId: string; conversationId: string }) {
  const order = await prisma.catalogOrder.findUniqueOrThrow({
    where: { id: params.orderId },
    select: { id: true, organizationId: true, leadId: true, status: true, quotedAt: true, quoteApprovedAt: true },
  });
  if (!(QUOTABLE_STATUSES as readonly string[]).includes(order.status)) {
    throw new CatalogQuoteError("Este pedido já tem cobrança ou foi finalizado; o valor não pode mais ser negociado.");
  }
  await prisma.catalogOrder.updateMany({
    where: { id: order.id, status: { in: [...QUOTABLE_STATUSES] }, quoteRequestedAt: null },
    data: { quoteRequestedAt: new Date(), status: "NEGOTIATING" },
  });
  await applyCatalogIntentTag({ organizationId: order.organizationId, leadId: order.leadId, key: "wantsQuote" });
  await signalLeadAwaitingHuman({
    organizationId: order.organizationId,
    leadId: order.leadId,
    conversationId: params.conversationId,
    reason: "quote_requested",
  });
  return { hasQuoteAlready: !!order.quotedAt, isApproved: !!order.quoteApprovedAt };
}

// Spec 0103, RF-4.
export async function approveOrderQuote(orderId: string) {
  const order = await prisma.catalogOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: { id: true, organizationId: true, leadId: true, quotedAt: true, total: true, internalApprovalStartedAt: true, internalApprovedAt: true },
  });
  if (!order.quotedAt) throw new CatalogQuoteError("Ainda não há valor enviado pelo atendente para este pedido.");
  if (isAwaitingInternalApproval(order)) {
    throw new CatalogQuoteError("O valor ainda está em aprovação interna; o cliente só pode aprovar depois que a equipe liberar.");
  }
  const approval = await prisma.catalogOrder.updateMany({
    where: { id: order.id, status: { in: [...QUOTABLE_STATUSES] }, quotedAt: order.quotedAt },
    data: { quoteApprovedAt: new Date() },
  });
  if (approval.count === 0) {
    throw new CatalogQuoteError("O valor mudou ou o pedido já tem cobrança. Consulte o pedido de novo.");
  }
  await applyCatalogIntentTag({ organizationId: order.organizationId, leadId: order.leadId, key: "wantsToPay" });
  return { total: Number(order.total) };
}

// Spec 0103, RF-3. Salva primeiro; o envio ao cliente é best-effort (RNF-2).
export async function sendOrderQuote(params: {
  organizationId: string;
  orderId: string;
  userId: string;
  senderName: string;
  quote: QuoteInput;
  note?: string;
}) {
  const order = await prisma.catalogOrder.findFirst({
    where: { id: params.orderId, organizationId: params.organizationId },
    select: {
      id: true,
      leadId: true,
      trackingId: true,
      status: true,
      nerpSaleNumber: true,
      items: true,
      lead: { select: { conversation: { select: { id: true } } } },
    },
  });
  if (!order) throw new CatalogQuoteError("Pedido não encontrado.");
  if (!(QUOTABLE_STATUSES as readonly string[]).includes(order.status)) {
    throw new CatalogQuoteError("Este pedido já tem cobrança ou foi finalizado; o valor não pode mais ser mudado.");
  }

  const totals = computeQuotedTotals(order.items as CatalogOrderItem[], params.quote);
  const quotedAt = new Date();
  const saved = await prisma.catalogOrder.updateMany({
    where: { id: order.id, status: { in: [...QUOTABLE_STATUSES] } },
    data: {
      items: totals.items,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      discount: totals.discount,
      total: totals.total,
      status: "NEGOTIATING",
      quotedAt,
      quotedById: params.userId,
      quoteApprovedAt: null,
    },
  });
  if (saved.count === 0) throw new CatalogQuoteError("O pedido mudou de situação enquanto o valor era salvo. Atualize a tela.");

  await prisma.catalogOrder.updateMany({ where: { id: order.id, quoteRequestedAt: null }, data: { quoteRequestedAt: quotedAt } });
  // O próximo passo (aprovação → cobrança) é do Astro: reativa a IA se alguém a tinha pausado.
  await prisma.lead.update({ where: { id: order.leadId }, data: { amount: toLeadAmountCents(totals.total), isActive: true } });
  await pusherServer.trigger(order.trackingId, "lead:updated", { leadId: order.leadId }).catch(() => undefined);

  // Spec 0104, D-5: com aprovadores, o valor vai para a aprovação da equipe pelo fluxo dos Gatilhos
  // (gatilho "Lead com tag" na tag abaixo); o cliente só recebe depois de aprovado.
  if (await hasActiveSalesApprovers(params.organizationId, "PRE_PAYMENT")) {
    await prisma.catalogOrder.update({ where: { id: order.id }, data: { internalApprovalStartedAt: quotedAt, internalApprovedAt: null } });
    await applyCatalogIntentTag({ organizationId: params.organizationId, leadId: order.leadId, key: "quoteInReview", shouldRetrigger: true });
    return { total: totals.total, isDelivered: false, isAwaitingInternalApproval: true };
  }

  const conversationId = order.lead.conversation?.id;
  let isDelivered = false;
  if (conversationId) {
    try {
      await deliverTextToLead({
        conversationId,
        senderName: params.senderName,
        text: buildQuoteMessageText({ saleNumber: order.nerpSaleNumber, ...totals, note: params.note }),
        metadata: { kind: "catalog_order_quote", catalogOrderId: order.id },
      });
      isDelivered = true;
    } catch (deliveryError) {
      console.error("[nerp-catalog/quote] envio do valor falhou", deliveryError);
    }
  }
  return { total: totals.total, isDelivered, isAwaitingInternalApproval: false };
}
