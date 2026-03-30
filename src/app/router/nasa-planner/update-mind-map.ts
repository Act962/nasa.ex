import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const updateMindMap = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      mindMapId: z.string(),
      name: z.string().optional(),
      nodes: z.array(z.record(z.string(), z.any())).optional(),
      edges: z.array(z.record(z.string(), z.any())).optional(),
      viewport: z.record(z.string(), z.any()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { mindMapId, ...data } = input;

    // First verify ownership
    const existing = await prisma.nasaPlannerMindMap.findFirst({
      where: { id: mindMapId, planner: { organizationId: context.org.id } },
    });
    if (!existing) throw new ORPCError("NOT_FOUND", { message: "Mapa não encontrado" });

    const mindMap = await prisma.nasaPlannerMindMap.update({
      where: { id: mindMapId },
      data: data as any,
    });

    return { mindMap };
  });
