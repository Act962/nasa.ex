import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { MessageStatus } from "@/features/tracking-chat/types";
import prisma from "@/lib/prisma";
import z from "zod";

export const markReadMessageHandler = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/mark-read",
    summary: "Mark messages as read",
  })
  .input(
    z.object({
      conversationId: z.string(),
      remoteJid: z.string(),
      token: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    try {
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
    } catch (e) {
      console.error("Error marking messages as read:", e);
      throw e;
    }
  });
