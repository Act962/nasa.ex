import { randomUUID } from "node:crypto";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { MessageStatus } from "@/generated/prisma/enums";
import { firePostInboundAutomations } from "@/features/tracking-chat/lib/incoming-message-pipeline";
import { findOrderByPublicToken } from "@/features/nerp-catalog/lib/portal-order";

// Mensagem do cliente pelo portal do pedido: mesmo caminho do In-Chat
// (`viaInChat`), então IA, alertas e ociosidade disparam igual ao WhatsApp.
export const sendPublicCatalogOrderMessage = base
  .input(
    z.object({
      token: z.string().min(16),
      body: z.string().trim().min(1).max(2000),
    }),
  )
  .handler(async ({ input, errors }) => {
    const order = await findOrderByPublicToken(input.token);
    const conversation = order?.lead.conversation;
    if (!order || !conversation) throw errors.NOT_FOUND({ message: "Pedido não encontrado" });

    const tracking = await prisma.tracking.findUniqueOrThrow({
      where: { id: conversation.trackingId },
      select: { globalAiActive: true },
    });
    const customer = order.customer as { name?: string };

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        messageId: `inchat-${randomUUID()}`,
        body: input.body,
        fromMe: false,
        status: MessageStatus.SEEN,
        senderName: customer.name ?? null,
        viaInChat: true,
      },
    });

    await firePostInboundAutomations({
      trackingId: conversation.trackingId,
      organizationId: order.organizationId,
      globalAiActive: tracking.globalAiActive,
      lead: { ...order.lead, conversation: { id: conversation.id } },
      messageId: message.id,
      externalMessageId: message.messageId,
      fromMe: false,
      channel: "IN_CHAT",
      messagePayload: message,
    });

    return { id: message.id, createdAt: message.createdAt };
  });
