import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const getPlanner = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ plannerId: z.string() }))
  .handler(async ({ input, context }) => {
    const planner = await prisma.nasaPlanner.findFirst({
      where: { id: input.plannerId, organizationId: context.org.id },
      include: {
        _count: {
          select: { posts: true, mindMaps: true, calendarShares: true },
        },
      },
    });

    if (!planner) throw new ORPCError("NOT_FOUND", { message: "Planner não encontrado" });

    return { planner };
  });
