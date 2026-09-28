import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { updateBroadcastSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { loadBroadcastForOrg } from "@/features/campanhas/server/lib/broadcast-access";

/** Atualiza campos editáveis da campanha na Fase 1 (nome). */
export const update = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(updateBroadcastSchema)
  .handler(async ({ input, context }) => {
    const { org } = context;
    await loadBroadcastForOrg(input.id, org.id);

    const updated = await prisma.broadcast.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
      },
      select: { id: true, name: true, status: true, updatedAt: true },
    });

    return updated;
  });
