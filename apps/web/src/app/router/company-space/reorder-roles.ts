import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { orgAdminGuard } from "./middlewares/org-admin-guard";

/**
 * Reordena nós do organograma (drag & drop).
 * Recebe um array de `{ id, order }`. Pode ser usado para reparentar
 * também quando vier `parentId` — a UI chama isto após cada drop.
 *
 * Todos os ids precisam pertencer à mesma org; caso contrário, 403.
 */
export const reorderRoles = base
  .use(orgAdminGuard)
  .input(
    z.object({
      orgId: z.string().min(1),
      items: z
        .array(
          z.object({
            id: z.string().min(1),
            order: z.number().int().min(0),
            parentId: z.string().nullable().optional(),
          }),
        )
        .min(1)
        .max(200),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // Valida que todos os ids pertencem à org
    const ids = input.items.map((i) => i.id);
    const existing = await prisma.orgRole.findMany({
      where: { id: { in: ids }, orgId: context.orgId },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      throw errors.FORBIDDEN({
        message: "Algum dos cargos não pertence a esta empresa.",
      });
    }

    await prisma.$transaction(
      input.items.map((item) =>
        prisma.orgRole.update({
          where: { id: item.id },
          data: {
            order: item.order,
            ...(item.parentId !== undefined ? { parentId: item.parentId } : {}),
          },
        }),
      ),
    );

    return { ok: true, reordered: input.items.length };
  });
