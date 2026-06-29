import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Reordena grupos via drag-and-drop. Recebe array de `{ id, order }` na
 * ordem nova e atualiza tudo em transação. UI envia depois do drop pra
 * persistir o snapshot atual.
 */
export const reorderTagGroups = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      groups: z.array(
        z.object({
          id: z.string(),
          order: z.number().int().min(0),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    // Bulk update — uma query por grupo, em transação pra atomicidade.
    // Pra <50 grupos (caso comum), performance é fine. Se precisar escalar,
    // trocar por UPDATE FROM VALUES.
    await prisma.$transaction(
      input.groups.map((g) =>
        prisma.tagGroup.update({
          where: {
            id: g.id,
            // Defensive: só atualiza se grupo pertence à org ativa
            organizationId: context.org.id,
          },
          data: { order: g.order },
        }),
      ),
    );

    return { ok: true, count: input.groups.length };
  });
