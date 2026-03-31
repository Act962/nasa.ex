import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listMindMaps = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ plannerId: z.string() }))
  .handler(async ({ input, context }) => {
    // Verify planner belongs to org
    await prisma.nasaPlanner.findFirstOrThrow({
      where: { id: input.plannerId, organizationId: context.org.id },
    });

    const mindMaps = await prisma.nasaPlannerMindMap.findMany({
      where: { plannerId: input.plannerId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { cards: true } } },
    });

    return { mindMaps };
  });
