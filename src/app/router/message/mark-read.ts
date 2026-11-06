import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import { MessageStatus } from "@/features/tracking-chat/types";
import prisma from "@/lib/prisma";
import z from "zod";

export const markReadMessageHandler = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/message/mark-read",
    summary: "Mark messages as read",
  })
  .input(
    z.object({
      conversationId: z.string(),
      /** @deprecated Não usado — mark-read é só update local no banco. */
      remoteJid: z.string().nullish(),
      /** @deprecated Não usado — mark-read não chama Uazapi. */
      token: z.string().nullish(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: { tracking: { select: { organizationId: true } } },
    });

    if (!conversation) {
      throw errors.NOT_FOUND({ message: "Conversa não encontrada" });
    }

    // Sem o escopo de org qualquer usuário autenticado marcava como lidas as
    // mensagens de uma conversa de outra empresa passando o `conversationId`.
    if (conversation.tracking.organizationId !== context.org.id) {
      throw errors.FORBIDDEN({ message: "Sem permissão" });
    }

    await prisma.message.updateMany({
      where: {
        conversationId: input.conversationId,
        fromMe: false,
        seen: false,
      },
      data: {
        seen: true,
        status: MessageStatus.SEEN,
      },
    });

    return { success: true };
  });
