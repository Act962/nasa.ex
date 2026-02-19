import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import z from "zod";
import { editMessage } from "@/http/uazapi/edit-message";
import prisma from "@/lib/prisma";
import { MessageStatus } from "@/generated/prisma/enums";

export const editMessageHandler = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/edit",
    summary: "Edit message",
  })
  .input(
    z.object({
      id: z.string(),
      text: z.string(),
      token: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    try {
      const response = await editMessage({
        data: {
          id: input.id,
          text: input.text,
        },
        token: input.token,
      });

      if (!response) {
        throw new Error("Failed to edit message or message not found");
      }

      await prisma.message.update({
        where: {
          messageId: input.id,
        },
        data: {
          body: response.content.text,
          messageId: response.messageid,
          status: MessageStatus.SEEN,
        },
      });

      return response;
    } catch (e) {
      console.error("Error editing message:", e);
      throw e;
    }
  });
