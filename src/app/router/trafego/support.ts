import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { getPublicMediaUrl } from "@/lib/r2-url";
import { randomUUID } from "crypto";
import { ensureTrafegoLeadForOrder } from "@/features/trafego/server/lib/ensure-trafego-lead";
import { ensureTrafegoConversation } from "@/features/trafego/server/lib/conversation-bridge";
import { firePostInboundAutomations } from "@/features/tracking-chat/lib/incoming-message-pipeline";

/** Thread de suporte do pedido, na visão do cliente. */
export const listTrafegoMessages = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const order = await assertOwnedOrder(input.orderId, context.org.id);
    const legacyMessages = await prisma.trafegoSupportMessage.findMany({
      where: { orderId: input.orderId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        body: true,
        authorRole: true,
        attachmentKey: true,
        createdAt: true,
        author: { select: { id: true, name: true, image: true } },
      },
    });

    const legacy = await Promise.all(
      legacyMessages.map(async (message) => ({
        ...message,
        attachmentUrl: message.attachmentKey
          ? await getPublicMediaUrl(message.attachmentKey)
          : null,
      })),
    );

    const conversationMessages = order.leadId
      ? await prisma.message.findMany({
          where: { conversation: { leadId: order.leadId } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            body: true,
            fromMe: true,
            mediaUrl: true,
            createdAt: true,
            senderName: true,
          },
        })
      : [];

    return [
      ...legacy,
      ...conversationMessages.map((message) => ({
        id: message.id,
        body: message.body ?? "",
        authorRole: message.fromMe ? ("NASA" as const) : ("CLIENT" as const),
        attachmentKey: message.mediaUrl,
        attachmentUrl: message.mediaUrl,
        createdAt: message.createdAt,
        author: {
          id: "conversation",
          name: message.fromMe ? message.senderName ?? "Equipe NASA" : "Você",
          image: null,
        },
      })),
    ].toSorted((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  });

export const sendTrafegoMessage = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      body: z.string().trim().min(1, "Escreva sua mensagem").max(4000),
      attachmentKey: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    let order = await assertOwnedOrder(input.orderId, context.org.id);
    const leadId = order.leadId ?? (await ensureTrafegoLeadForOrder(order.id));
    if (!leadId) {
      throw new ORPCError("BAD_REQUEST", { message: "Não foi possível preparar a conversa deste pedido." });
    }

    order = await prisma.trafegoOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: {
        id: true,
        leadId: true,
        whatsappNumber: true,
        pendingPurchase: { select: { phone: true } },
        lead: {
          select: {
            id: true,
            isActive: true,
            firstResponseAt: true,
            lastInboundAt: true,
            tracking: { select: { id: true, organizationId: true, globalAiActive: true } },
          },
        },
      },
    });
    const lead = order.lead;
    if (!lead) {
      throw new ORPCError("BAD_REQUEST", { message: "Lead do pedido não encontrado." });
    }
    const conversation = await ensureTrafegoConversation({
      leadId,
      trackingId: lead.tracking.id,
      phone: order.pendingPurchase?.phone ?? order.whatsappNumber,
    });

    const externalMessageId = `trafego-panel-${randomUUID()}`;
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        body: input.body,
        messageId: externalMessageId,
        fromMe: false,
        status: "SEEN",
        viaInChat: true,
        metadata: { source: "trafego_panel", attachmentKey: input.attachmentKey ?? null },
      },
      select: { id: true, createdAt: true, body: true, conversationId: true },
    });

    await firePostInboundAutomations({
      trackingId: lead.tracking.id,
      organizationId: lead.tracking.organizationId,
      globalAiActive: lead.tracking.globalAiActive,
      lead: {
        id: lead.id,
        isActive: lead.isActive,
        firstResponseAt: lead.firstResponseAt,
        lastInboundAt: lead.lastInboundAt,
        conversation,
      },
      messageId: message.id,
      externalMessageId,
      fromMe: false,
      channel: "IN_CHAT",
      leadMessage: { text: message.body ?? "", messageId: externalMessageId, sentAt: message.createdAt.toISOString(), source: "TRIGGER_EVENT" },
      messagePayload: { ...message, conversation: { id: conversation.id, lead: { id: lead.id } } },
    });

    return message;
  });

export const markTrafegoMessagesRead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    await assertOwnedOrder(input.orderId, context.org.id);

    return { success: true };
  });

async function assertOwnedOrder(orderId: string, organizationId: string) {
  const order = await prisma.trafegoOrder.findFirst({
    where: { id: orderId, organizationId },
    select: { id: true, leadId: true },
  });
  if (!order) {
    throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada." });
  }
  return order;
}
