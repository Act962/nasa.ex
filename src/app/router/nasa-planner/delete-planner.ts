import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deletePlanner = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ plannerId: z.string() }))
  .handler(async ({ input, context }) => {
    const planner = await prisma.nasaPlanner.findUnique({
      where: { id: input.plannerId, organizationId: context.org.id },
      select: { name: true },
    });

    await prisma.nasaPlanner.delete({
      where: { id: input.plannerId, organizationId: context.org.id },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nasa-planner",
      action: "planner.deleted",
      actionLabel: `Excluiu o planner "${planner?.name ?? input.plannerId}"`,
      resource: planner?.name,
      resourceId: input.plannerId,
    });

    return { ok: true };
  });
