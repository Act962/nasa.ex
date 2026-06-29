import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listCards = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      mindMapId: z.string().optional(),
      plannerId: z.string().optional(),
      status: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const cards = await prisma.nasaPlannerCard.findMany({
      where: {
        ...(input.mindMapId ? { mindMapId: input.mindMapId } : {}),
        ...(input.plannerId ? { plannerId: input.plannerId } : {}),
        ...(input.status ? { status: input.status as any } : {}),
        mindMap: { planner: { organizationId: context.org.id } },
      },
      orderBy: { createdAt: "asc" },
    });

    return { cards };
  });
