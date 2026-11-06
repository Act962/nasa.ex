import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import z from "zod";
import dayjs from "dayjs";
import _ from "lodash";
import prisma from "@/lib/prisma";

export const listMessage = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/message/list",
    summary: "List messages",
  })
  .input(
    z.object({
      conversationId: z.string(),
      limit: z.number().min(1).max(100).optional(),
      cursor: z.string().optional(),
    }),
  )

  .handler(async ({ input, context, errors }) => {
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: input.conversationId,
      },
      select: {
        remoteJid: true,
        tracking: { select: { organizationId: true } },
      },
    });

    if (!conversation) {
      throw errors.NOT_FOUND({ message: "Conversa não encontrada" });
    }

    // Escopo de organização: a conversa só pode ser lida por quem está na
    // mesma org do tracking dono dela. Sem isso qualquer usuário autenticado
    // leria as mensagens de outra empresa passando o `conversationId` (IDOR).
    if (conversation.tracking.organizationId !== context.org.id) {
      throw errors.FORBIDDEN({ message: "Sem permissão" });
    }

    const limit = input.limit ?? 30;

    const messages = await prisma.message.findMany({
      where: {
        conversationId: input.conversationId,
      },
      include: {
        quotedMessage: {
          include: {
            conversation: {
              include: {
                lead: true,
              },
            },
          },
        },
        conversation: {
          include: {
            lead: true,
          },
        },
      },
      ...(input.cursor
        ? {
            cursor: { id: input.cursor },
            skip: 1,
          }
        : {}),
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    const grouped = _.groupBy(messages, (message) =>
      dayjs(message.createdAt).format("YYYY-MM-DD"),
    );
    const groupedItems = Object.entries(grouped).map(([date, msgs]) => ({
      date,
      messages: msgs,
    }));
    const nextCursor =
      messages.length === limit
        ? messages[messages.length - 1].id
        : undefined;

    return {
      items: groupedItems,
      nextCursor,
      remoteJid: conversation.remoteJid,
    };
  });
