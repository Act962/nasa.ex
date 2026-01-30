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
      const conversations = await prisma.conversation.findMany({
        where: {
          trackingId: input.trackingId,
        },
        include: {
          messages: true,
          lead: true,
        },
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

      return {
        items: newConversations,
      };
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
