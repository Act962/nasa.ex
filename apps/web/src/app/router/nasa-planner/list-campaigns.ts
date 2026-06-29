import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listCampaigns = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      status: z.string().optional(),
      plannerId: z.string().optional(),
    }).optional(),
  )
  .handler(async ({ input, context }) => {
    const campaigns = await prisma.nasaCampaignPlanner.findMany({
      where: {
        organizationId: context.org.id,
        deletedAt: null,
        ...(input?.status ? { status: input.status as any } : {}),
        ...(input?.plannerId ? { plannerId: input.plannerId } : {}),
      },
      include: {
        onboarding: true,
        publicAccess: true,
        _count: { select: { events: true, tasks: true, brandAssets: true } },
        events: {
          where: { scheduledAt: { gte: new Date() }, status: "SCHEDULED" },
          orderBy: { scheduledAt: "asc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { campaigns };
  });
