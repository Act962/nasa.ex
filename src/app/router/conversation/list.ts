import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import z from "zod";
import prisma from "@/lib/prisma";

export const listConversation = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/conversation/list",
    summary: "List conversations",
  })
  .input(
    z.object({
      trackingId: z.string(),
      statusId: z.string().nullable(),
      search: z.string().nullable(),
      limit: z.number().min(1).max(100).optional(),
      cursor: z.string().optional(),
    }),
  )

  .handler(async ({ input, context, errors }) => {
    try {
      const limit = input.limit ?? 30;
      const conversations = await prisma.conversation.findMany({
        where: {
          trackingId: input.trackingId,
          ...(input.statusId && {
            lead: {
              statusId: input.statusId,
            },
          }),
          ...(input.search && {
            lead: {
              OR: [
                {
                  name: {
                    contains: input.search,
                    mode: "insensitive",
                  },
                },
                {
                  phone: {
                    contains: input.search,
                    mode: "insensitive",
                  },
                },
              ],
            },
          }),
        },
        include: {
          lastMessage: true,
          _count: {
            select: {
              messages: {
                where: {
                  seen: false,
                  fromMe: false,
                },
              },
            },
          },
          lead: {
            include: {
              leadTags: {
                include: {
                  tag: true,
                },
              },
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
        orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
      });

      if (!conversations) {
        throw errors.BAD_REQUEST;
      }

      const newConversations = conversations.map((conversation) => {
        const { _count, ...rest } = conversation;
        return {
          ...rest,
          unreadCount: _count.messages,
        };
      });

      const nextCursor =
        conversations.length === limit
          ? conversations[conversations.length - 1].id
          : undefined;

      return {
        items: newConversations,
        nextCursor,
      };
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
