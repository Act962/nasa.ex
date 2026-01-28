import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import z from "zod";
import { Conversation, Lead } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

interface ConversationWithLead extends Conversation {
  lead: Lead;
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
          lead: true,
        },
      });

      if (!conversations) {
        throw errors.BAD_REQUEST;
      }

      return {
        items: conversations,
      };
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
