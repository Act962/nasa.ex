import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listOrgProjects = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ type: z.string().optional(), isActive: z.boolean().optional(), orgId: z.string().optional() }).optional())
  .handler(async ({ input, context }) => {
    // If orgId provided, verify the current user is a member of that org
    let organizationId = context.org.id;
    if (input?.orgId && input.orgId !== context.org.id) {
      const member = await prisma.member.findFirst({
        where: { organizationId: input.orgId, userId: context.user.id },
        select: { id: true },
      });
      if (member) organizationId = input.orgId;
    }

    const projects = await prisma.orgProject.findMany({
      where: {
        organizationId,
        ...(input?.type ? { type: input.type } : {}),
        ...(input?.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: {
        _count: { select: { leads: true, trackings: true, actions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Include brand fields in each project so callers can use them
    // (slogan, icp, positioning, voiceTone, visual, aiInstructions, swot are already on the model)
    return { projects };
  });
