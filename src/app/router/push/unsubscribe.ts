import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Remove a inscrição de Web Push do browser atual (spec 0022).
 *
 * O `userId` entra no filtro, não só o endpoint: sem isso qualquer usuário
 * logado apagaria a inscrição de outro bastando conhecer a URL dela (CA-5).
 * `deleteMany` é idempotente — cancelar duas vezes não é erro.
 */
export const unsubscribeFromPush = base
  .use(requiredAuthMiddleware)
  .input(z.object({ endpoint: z.string().trim().url().max(1000) }))
  .output(z.object({ removed: z.number().int().nonnegative() }))
  .handler(async ({ input, context }) => {
    const result = await prisma.pushSubscription.deleteMany({
      where: { endpoint: input.endpoint, userId: context.user.id },
    });

    return { removed: result.count };
  });
