import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { sendText } from "@/http/uazapi/send-text";
import prisma from "@/lib/prisma";
import z from "zod";

export const createTextMessage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/create",
    summary: "Create message",
  })
  .input(
    z.object({
      conversationId: z.string(),
      body: z.string(),
      leadPhone: z.string(),
      token: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    try {
      const response = await sendText(input.token, {
        text: input.body,
        number: input.leadPhone,
        delay: 2000,
      });

      const message = await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          body: input.body,
          messageId: response.id,
        },
        include: {
          conversation: {
            include: {
              lead: true,
            },
          },
        },
      });
      return {
        message: {
          id: message.id,
          body: message.body,
          createdAt: message.createdAt,
          fromMe: true,
          mediaUrl: null,
          conversation: {
            lead: {
              id: message.conversation.lead.id,
              name: message.conversation.lead.name,
            },
          },
        },
      };
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
