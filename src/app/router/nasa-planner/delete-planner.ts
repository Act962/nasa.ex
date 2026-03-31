import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deletePlanner = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ plannerId: z.string() }))
  .handler(async ({ input, context }) => {
    await prisma.nasaPlanner.delete({
      where: { id: input.plannerId, organizationId: context.org.id },
    });

    return { ok: true };
  });
