import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import z from "zod";

export const editActionChatMessage = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/action/chat/edit",
    summary: "Edit chat message",
  })
  .input(
    z.object({
      messageId: z.string(),
      body: z.string().min(1),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.actionChatMessage.findUnique({
      where: { id: input.messageId },
      select: { id: true, senderId: true, actionId: true, isDeleted: true },
    });

    if (!existing) throw errors.NOT_FOUND({ message: "Mensagem não encontrada" });
    if (existing.senderId !== context.user.id)
      throw errors.FORBIDDEN({ message: "Você só pode editar suas mensagens" });
    if (existing.isDeleted)
      throw errors.BAD_REQUEST({ message: "Mensagem foi apagada" });

    const message = await prisma.actionChatMessage.update({
      where: { id: input.messageId },
      data: {
        body: input.body,
        isEdited: true,
      },
      include: {
        sender: { select: { id: true, name: true, image: true } },
        quotedMessage: {
          select: {
            id: true,
            body: true,
            mediaUrl: true,
            mediaType: true,
            mimetype: true,
            fileName: true,
            senderId: true,
            senderName: true,
            isDeleted: true,
            createdAt: true,
          },
        },
      },
    });

    await pusherServer.trigger(
      `action-chat-${existing.actionId}`,
      "message:edited",
      { ...message, currentUserId: context.user.id },
    );

    return { message };
  });
