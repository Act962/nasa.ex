import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import z from "zod";

export const deleteActionChatMessage = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/action/chat/delete",
    summary: "Soft-delete chat message",
  })
  .input(z.object({ messageId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.actionChatMessage.findUnique({
      where: { id: input.messageId },
      select: { id: true, senderId: true, actionId: true, isDeleted: true },
    });

    if (!existing) throw errors.NOT_FOUND({ message: "Mensagem não encontrada" });
    if (existing.senderId !== context.user.id)
      throw errors.FORBIDDEN({ message: "Você só pode apagar suas mensagens" });
    if (existing.isDeleted) return { success: true };

    await prisma.actionChatMessage.update({
      where: { id: input.messageId },
      data: {
        isDeleted: true,
        body: null,
        mediaUrl: null,
        mediaType: null,
        mimetype: null,
        fileName: null,
      },
    });

    await pusherServer.trigger(
      `action-chat-${existing.actionId}`,
      "message:deleted",
      { messageId: input.messageId, currentUserId: context.user.id },
    );

    return { success: true };
  });
