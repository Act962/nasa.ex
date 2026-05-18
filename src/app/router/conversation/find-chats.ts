import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import z from "zod";
import prisma from "@/lib/prisma";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import { findChats } from "@/http/uazapi/find-chat";

export const findChatByPhone = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/conversation/find-by-phone",
    summary: "Find conversation by phone in tracking",
  })
  .input(
    z.object({
      trackingId: z.string(),
      phone: z.string(),
      name: z.string(),
      isGroup: z.boolean().optional(),
      limit: z.number(),
      offset: z.number(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const { phone, trackingId, name, isGroup, limit, offset } = input;
    try {
      const instace = await prisma.whatsAppInstance.findUnique({
        where: {
          trackingId: trackingId,
        },
        select: {
          apiKey: true,
          baseUrl: true,
          status: true,
        },
      });

      if (!instace) {
        throw errors.NOT_FOUND();
      }

      if (instace.status === WhatsAppInstanceStatus.DISCONNECTED) {
        throw errors.BAD_REQUEST();
      }

      const response = await findChats(instace.apiKey, {
        name,
        wa_isGroup: isGroup,
        limit,
        offset,
      });

      return {
        response,
      };
    } catch (err) {
      console.log("Erro ao buscar os chats", err);
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
