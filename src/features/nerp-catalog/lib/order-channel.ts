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
    const resolved = await resolveOutboundProvider(conversation.trackingId);
    const result = await resolved.provider.sendText({
      kind: "text",
      to: phone,
      body: input.text,
    });
    externalMessageId = result.externalMessageId;
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
