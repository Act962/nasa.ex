import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import dayjs from "dayjs";
import _ from "lodash";
import z from "zod";
import { assertActionAccess } from "./_helpers";

export const listActionChat = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/action/chat/list",
    summary: "List chat messages for an action",
  })
  .input(
    z.object({
      actionId: z.string(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { hasAccess } = await assertActionAccess(
      input.actionId,
      context.user.id,
      context.org,
    );
    if (!hasAccess) throw errors.FORBIDDEN({ message: "Sem acesso ao chat" });

    const limit = input.limit ?? 30;

    const messages = await prisma.actionChatMessage.findMany({
      where: {
        actionId: input.actionId,
      },
      include: {
        sender: {
          select: { id: true, name: true, image: true },
        },
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
      ...(input.cursor
        ? {
            cursor: { id: input.cursor },
            skip: 1,
          }
        : {}),
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    const grouped = _.groupBy(messages, (m) =>
      dayjs(m.createdAt).format("YYYY-MM-DD"),
    );
    const items = Object.entries(grouped).map(([date, msgs]) => ({
      date,
      messages: msgs,
    }));

    const nextCursor =
      messages.length === limit ? messages[messages.length - 1].id : undefined;

    return { items, nextCursor };
  });
