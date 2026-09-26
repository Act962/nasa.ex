import { z } from "zod";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { findOrderByPublicToken } from "@/features/nerp-catalog/lib/portal-order";

const MESSAGES_PAGE_SIZE = 60;

export const listPublicCatalogOrderMessages = base
  .input(z.object({ token: z.string().min(16) }))
  .handler(async ({ input, errors }) => {
    const order = await findOrderByPublicToken(input.token);
    const conversationId = order?.lead.conversation?.id;
    if (!order || !conversationId) throw errors.NOT_FOUND({ message: "Pedido não encontrado" });

    const messages = await prisma.message.findMany({
      where: { conversationId, status: { not: "DELETED" } },
      orderBy: { createdAt: "desc" },
      take: MESSAGES_PAGE_SIZE,
      select: {
        id: true,
        body: true,
        fromMe: true,
        senderName: true,
        mediaType: true,
        mediaCaption: true,
        createdAt: true,
      },
    });
    return { messages: messages.reverse() };
  });
