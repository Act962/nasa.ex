import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const startTimer = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const userId = context.user.id;
    const now = new Date();

    // 1. Pausar qualquer cronômetro ativo do usuário (Regra: apenas um por vez)
    const activeTimer = await prisma.actionTimer.findFirst({
      where: {
        userId,
        stoppedAt: null,
      },
    });

    if (activeTimer) {
      const sessionDuration = Math.floor(
        (now.getTime() - activeTimer.startedAt.getTime()) / 1000
      );
      
      await prisma.actionTimer.update({
        where: { id: activeTimer.id },
        data: {
          stoppedAt: now,
          duration: sessionDuration > 0 ? sessionDuration : 0,
        },
      });
    }

    // 2. Iniciar o novo cronômetro para a ação selecionada
    const newTimer = await prisma.actionTimer.create({
      data: {
        actionId: input.actionId,
        userId,
        startedAt: now,
      },
    });

    // 3. Buscar tempo acumulado da ação para sincronia do front
    const pastSessions = await prisma.actionTimer.aggregate({
      where: {
        actionId: input.actionId,
        stoppedAt: { not: null },
      },
      _sum: {
        duration: true,
      },
    });

    return { 
      timer: newTimer,
      accumulatedSeconds: pastSessions._sum.duration || 0,
      serverTime: now,
    };
  });


