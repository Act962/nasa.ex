import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const stopTimer = base
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

    // Encontrar o cronômetro ativo para essa ação e usuário
    const activeTimer = await prisma.actionTimer.findFirst({
      where: {
        actionId: input.actionId,
        userId,
        stoppedAt: null,
      },
      orderBy: {
         startedAt: "desc"
      }
    });

    if (!activeTimer) {
      return { success: false, message: "No active timer found for this action" };
    }

    const sessionDuration = Math.floor(
      (now.getTime() - activeTimer.startedAt.getTime()) / 1000
    );

    const timer = await prisma.actionTimer.update({
      where: { id: activeTimer.id },
      data: {
        stoppedAt: now,
        duration: sessionDuration > 0 ? sessionDuration : 0,
      },
    });

    return { 
      success: true,
      timer 
    };
  });
