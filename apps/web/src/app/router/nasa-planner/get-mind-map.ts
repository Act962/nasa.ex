import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const getMindMap = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ mindMapId: z.string() }))
  .handler(async ({ input, context }) => {
    const existing = await prisma.nasaPlannerMindMap.findFirst({
      where: { id: input.mindMapId, planner: { organizationId: context.org.id } },
    });

    if (!existing) throw new ORPCError("NOT_FOUND", { message: "Mapa mental não encontrado" });

    const mindMap = await prisma.nasaPlannerMindMap.findFirst({
      where: { id: input.mindMapId },
      include: {
        cards: { orderBy: { createdAt: "asc" } },
      },
    });

    return { mindMap };
  });
