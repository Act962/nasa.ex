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
  .handler(async ({ input, context }) => {
    try {
      const { conversationId } = input;
      const conversation = await prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },
        include: {
          // Inclui `status` (nome da coluna kanban) pra o header da
          // conversa mostrar o breadcrumb "Tracking > Status" estilo
          // CRM. O `tracking.name` segue o mesmo objetivo.
          lead: {
            include: {
              status: { select: { id: true, name: true } },
              // Anel de temperatura na foto do cabeçalho, igual ao da lista (spec 0035, RF-10).
              metrics: true,
            },
          },
          tracking: {
            select: {
              id: true,
              name: true,
            },
          },
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
