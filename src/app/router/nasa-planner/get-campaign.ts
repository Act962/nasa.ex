import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getCampaign = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ campaignId: z.string() }))
  .handler(async ({ input, context }) => {
    const campaign = await prisma.nasaCampaignPlanner.findFirst({
      where: { id: input.campaignId, organizationId: context.org.id, deletedAt: null },
      include: {
        onboarding: true,
        events: { orderBy: { scheduledAt: "asc" } },
        tasks: { orderBy: { createdAt: "desc" } },
        brandAssets: { orderBy: { createdAt: "desc" } },
        publicAccess: true,
        planner: { select: { id: true, name: true, brandName: true } },
      },
    });

    if (!campaign) throw new Error("Planejamento não encontrado.");
    return { campaign };
  });
