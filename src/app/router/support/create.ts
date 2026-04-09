import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createSupportTicket = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      appId: z.string().min(1, "Selecione o aplicativo"),
      improvement: z
        .string()
        .min(10, "Descreva a melhoria com pelo menos 10 caracteres"),
      imageUrl: z.string().optional(),
    }),
  )

  .handler(async ({ input, context, errors }) => {
    try {
      const ticket = await prisma.supportTicket.create({
        data: {
          appId: input.appId,
          improvement: input.improvement,
          imageUrl: input.imageUrl,
          userId: context.user.id,
        },
      });

      return {
        ticketId: ticket.id,
      };
    } catch (e) {
      console.error(e);
      throw errors.INTERNAL_SERVER_ERROR({ message: "Erro ao criar ticket" });
    }
  });
