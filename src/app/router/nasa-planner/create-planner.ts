import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createPlanner = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().min(1, "Nome é obrigatório"),
      description: z.string().optional(),
      brandName: z.string().optional(),
      orgProjectId: z.string().optional(),
      clientOrgId: z.string().optional(),
      clientOrgName: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const planner = await prisma.nasaPlanner.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        description: input.description,
        brandName: input.brandName ?? input.clientOrgName,
        orgProjectId: input.orgProjectId,
        clientOrgId: input.clientOrgId,
        clientOrgName: input.clientOrgName,
      },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nasa-planner",
      action: "planner.created",
      actionLabel: `Criou o planner "${planner.name}"`,
      resource: planner.name,
      resourceId: planner.id,
    });

    return { planner };
  });
