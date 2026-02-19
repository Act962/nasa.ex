import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import z from "zod";
import { Conversation, Lead } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { Message } from "@/generated/prisma/client";

interface ConversationWithLead extends Conversation {
  lead: Lead;
  lastMessage: Message;
}

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
  .output(
    z.object({
      items: z.array(z.custom<ConversationWithLead>()),
      nextCursor: z.string().optional(),
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
              name: {
                contains: input.search,
                mode: "insensitive",
              },
            },
          }),
        },
        include: {
          messages: true,
          lead: true,
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

      if (!conversations) {
        throw errors.BAD_REQUEST;
      }

      const newConversations = conversations.map((conversation) => ({
        ...conversation,
        messages: conversation.messages.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        ),
        lastMessage: conversation.messages[0],
      }));

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
