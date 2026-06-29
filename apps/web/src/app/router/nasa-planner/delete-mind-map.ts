import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const deleteMindMap = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ mindMapId: z.string() }))
  .handler(async ({ input, context }) => {
    // First verify ownership
    const existing = await prisma.nasaPlannerMindMap.findFirst({
      where: { id: input.mindMapId, planner: { organizationId: context.org.id } },
    });
    if (!existing) throw new ORPCError("NOT_FOUND", { message: "Mapa não encontrado" });

    await prisma.nasaPlannerMindMap.delete({
      where: { id: input.mindMapId },
    });

    return { ok: true };
  });
