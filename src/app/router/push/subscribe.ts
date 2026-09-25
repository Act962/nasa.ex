import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Registra a inscrição de Web Push do browser atual (spec 0022).
 *
 * O `endpoint` é a identidade da inscrição e é único globalmente. Reinscrever o
 * mesmo browser atualiza a linha em vez de duplicar (CA-3); se a linha existia
 * sob outro usuário, ela é reassociada — é o mesmo browser depois de troca de
 * conta (CB-3).
 */
export const subscribeToPush = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      endpoint: z.string().trim().url().max(1000),
      keys: z.object({
        p256dh: z.string().trim().min(1).max(255),
        auth: z.string().trim().min(1).max(255),
      }),
      userAgent: z.string().trim().max(400).nullish(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const data = {
      userId: context.user.id,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent ?? null,
      failureCount: 0,
    };

    await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { ...data, endpoint: input.endpoint },
      update: data,
    });

    return { ok: true as const };
  });
