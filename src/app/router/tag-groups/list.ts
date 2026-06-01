import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista todos os grupos de tags da organização ativa, ordenados por
 * `order` ASC (configurável via drag-and-drop) + nome como tiebreaker.
 * Inclui contagem de tags ATIVAS por grupo — UI mostra "Estética (4)".
 */
export const listTagGroups = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.void())
  .handler(async ({ context }) => {
    const groups = await prisma.tagGroup.findMany({
      where: { organizationId: context.org.id },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        color: true,
        icon: true,
        order: true,
        _count: { select: { tags: { where: { archivedAt: null } } } },
      },
    });

    return {
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        icon: g.icon,
        order: g.order,
        activeTagCount: g._count.tags,
      })),
    };
  });
