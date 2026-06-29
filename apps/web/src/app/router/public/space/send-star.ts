import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

/**
 * Envia SpaceStationStar (sistema pré-existente) de uma Space Station
 * para outra. Requer auth e saldo — aqui cobrimos o caso simples:
 * o usuário envia do próprio station p/ station da org.
 */
export const sendStar = base
  .use(requiredAuthMiddleware)
  .use(spaceVisibilityGuard)
  .input(
    z.object({
      nick: z.string().min(1),
      amount: z.number().int().min(1).max(1000).default(1),
      message: z.string().max(240).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { station, user } = context;

    const fromStation = await prisma.spaceStation.findUnique({
      where: { userId: user.id },
      select: { id: true, starsReceived: true },
    });

    if (!fromStation) {
      throw errors.FORBIDDEN({
        message: "Você ainda não tem uma Space Station. Crie uma para enviar STARs.",
      });
    }

    if (fromStation.id === station.id) {
      throw errors.BAD_REQUEST({
        message: "Você não pode enviar STAR para si mesmo.",
      });
    }

    const [star] = await prisma.$transaction([
      prisma.spaceStationStar.create({
        data: {
          fromId: fromStation.id,
          toId: station.id,
          amount: input.amount,
          message: input.message ?? null,
        },
        select: { id: true, amount: true, createdAt: true },
      }),
      prisma.spaceStation.update({
        where: { id: station.id },
        data: { starsReceived: { increment: input.amount } },
      }),
    ]);

    return star;
  });
