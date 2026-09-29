import "server-only";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import { shouldSkipUazapiForConversation } from "@/features/tracking-chat/lib/in-chat-mode";
import { persistOutboundMessage } from "@/features/tracking-chat-ai/lib/persist";

export const CATALOG_ORDER_MESSAGE_PREFIX = "nerp-order-";

// Resposta vai pelo canal em que o cliente falou por último. Pedido do
// catálogo começa no portal (/pedido/<token>): só vira WhatsApp quando o
// próprio cliente escreve por lá — conversa iniciada por ele não custa
// template na API oficial.
export async function shouldReplyInPortal(conversationId: string): Promise<boolean> {
  const lastInbound = await prisma.message.findFirst({
    where: { conversationId, fromMe: false },
    orderBy: { createdAt: "desc" },
    select: { viaInChat: true, messageId: true },
  });
  if (lastInbound?.messageId.startsWith(CATALOG_ORDER_MESSAGE_PREFIX)) return true;
  if (lastInbound?.viaInChat) return true;

  const hasOpenCatalogOrder = await prisma.catalogOrder.count({
    where: {
      lead: { conversation: { id: conversationId } },
      status: { notIn: ["DELIVERED", "CANCELED"] },
    },
  });
  if (hasOpenCatalogOrder > 0 && !lastInbound) return true;

  return shouldSkipUazapiForConversation(conversationId);
}

// Só conversas de pedido do catálogo: as demais seguem a regra do In-Chat (instância banida/offline).
export async function isCatalogPortalConversation(conversationId: string): Promise<boolean> {
  const catalogOrderCount = await prisma.catalogOrder.count({
    where: { lead: { conversation: { id: conversationId } } },
  });
  if (catalogOrderCount === 0) return false;
  return shouldReplyInPortal(conversationId);
}

export type DeliverTextInput = {
  conversationId: string;
  text: string;
  senderName: string;
  metadata?: Prisma.InputJsonValue | null;
};

// A conversa carrega o tracking certo mesmo depois do lead mudar de funil.
export async function deliverTextToLead(input: DeliverTextInput) {
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: input.conversationId },
    select: { trackingId: true, leadId: true, lead: { select: { phone: true } } },
  });
  const phone = conversation.lead.phone;
  const isPortal = !phone || (await shouldReplyInPortal(input.conversationId));

  let externalMessageId = `inchat-${randomUUID()}`;
  if (!isPortal && phone) {
    // Sem instância de WhatsApp a mensagem fica no chat e no portal, em vez de se perder.
    const resolved = await resolveOutboundProvider(conversation.trackingId).catch(() => null);
    if (resolved) {
      const result = await resolved.provider.sendText({ kind: "text", to: phone, body: input.text });
      externalMessageId = result.externalMessageId;
    }
  }

  return persistOutboundMessage({
    conversationId: input.conversationId,
    leadId: conversation.leadId,
    trackingId: conversation.trackingId,
    body: input.text,
    senderName: input.senderName,
    externalMessageId,
    metadata: input.metadata ?? null,
  });
}

export type OrderLinkWhatsappResult = "sent" | "no_whatsapp" | "official_needs_template" | "no_phone";

// Link de acompanhamento logo que o pedido chega. Só pelo WhatsApp por QR Code: na API
// oficial, mensagem livre sem o cliente ter escrito antes é recusada (exige modelo pago).
export async function sendOrderLinkByWhatsapp(input: {
  conversationId: string;
  text: string;
  catalogOrderId: string;
}): Promise<OrderLinkWhatsappResult> {
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: input.conversationId },
    select: { trackingId: true, leadId: true, lead: { select: { phone: true } } },
  });
  const phone = conversation.lead.phone;
  if (!phone) return "no_phone";

  let resolved: Awaited<ReturnType<typeof resolveOutboundProvider>>;
  try {
    resolved = await resolveOutboundProvider(conversation.trackingId);
  } catch {
    return "no_whatsapp";
  }
  if (resolved.providerId !== "uazapi") return "official_needs_template";

  const result = await resolved.provider.sendText({ kind: "text", to: phone, body: input.text });
  await persistOutboundMessage({
    conversationId: input.conversationId,
    leadId: conversation.leadId,
    trackingId: conversation.trackingId,
    body: input.text,
    senderName: "Astro",
    externalMessageId: result.externalMessageId,
    metadata: { kind: "catalog_order_link", catalogOrderId: input.catalogOrderId },
  });
  return "sent";
}

// Aviso de etapa do pedido (spec 0044): sempre fica no chat/portal e, com WhatsApp por QR Code,
// sai também no WhatsApp — a API oficial recusa texto livre sem o cliente ter escrito antes.
export async function sendOrderNotice(input: {
  conversationId: string;
  text: string;
  metadata: Prisma.InputJsonValue;
}): Promise<OrderLinkWhatsappResult> {
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: input.conversationId },
    select: { trackingId: true, leadId: true, lead: { select: { phone: true } } },
  });
  const phone = conversation.lead.phone;
  let externalMessageId = `inchat-${randomUUID()}`;
  let whatsappResult: OrderLinkWhatsappResult = phone ? "no_whatsapp" : "no_phone";

  if (phone) {
    const resolved = await resolveOutboundProvider(conversation.trackingId).catch(() => null);
    if (resolved?.providerId === "uazapi") {
      const result = await resolved.provider.sendText({ kind: "text", to: phone, body: input.text });
      externalMessageId = result.externalMessageId;
      whatsappResult = "sent";
    } else if (resolved) {
      whatsappResult = "official_needs_template";
    }
  }

  await persistOutboundMessage({
    conversationId: input.conversationId,
    leadId: conversation.leadId,
    trackingId: conversation.trackingId,
    body: input.text,
    senderName: "Astro",
    externalMessageId,
    metadata: input.metadata,
  });
  return whatsappResult;
}
