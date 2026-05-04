import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const createPostFromAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      plannerId: z.string(),
      type: z.enum(["STATIC", "CAROUSEL", "REEL", "STORY"]).default("STATIC"),
      targetNetworks: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const [action, planner] = await Promise.all([
      prisma.action.findFirst({ where: { id: input.actionId, organizationId: context.org.id } }),
      prisma.nasaPlanner.findFirst({ where: { id: input.plannerId, organizationId: context.org.id } }),
    ]);

    if (!action) throw new ORPCError("NOT_FOUND", { message: "Card não encontrado" });
    if (!planner) throw new ORPCError("NOT_FOUND", { message: "Planner não encontrado" });

    const post = await prisma.nasaPlannerPost.create({
      data: {
        plannerId: input.plannerId,
        organizationId: context.org.id,
        createdById: context.user.id,
        title: action.title,
        type: input.type as any,
        targetNetworks: input.targetNetworks ?? [],
        referenceLinks: [],
      },
    });

    return { post };
  });
