import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import z from "zod";
import { deleteMessage } from "@/http/uazapi/delete-message";
import prisma from "@/lib/prisma";

export const deleteMessageHandler = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/delete",
    summary: "Delete message",
  })
  .input(
    z.object({
      id: z.string(),
      token: z.string(),
      messageId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const response = await deleteMessage({
        id: input.id,
        token: input.token,
      });

      if (!response) {
        throw new Error("Message not found");
      }
      console.log(response);

      await prisma.message.delete({
        where: {
          messageId: input.id,
        },
      });
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
