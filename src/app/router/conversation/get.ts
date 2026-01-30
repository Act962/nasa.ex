import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import z from "zod";
import { Conversation, Lead } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

export const getConversation = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/conversation/list",
    summary: "List conversations",
  })
  .input(
    z.object({
      conversationId: z.string(),
    }),
  )
  .output(
    z.object({
      conversation: z.object({
        id: z.string(),
        lead: z.object({
          id: z.string(),
          name: z.string(),
          phone: z.string().nullable(),
        }),
      }),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const { conversationId } = input;
      const conversation = await prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },
        include: {
          lead: true,
        },
      });

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      return {
        conversation,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
