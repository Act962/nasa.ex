import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getCampaignCalendar = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      campaignIds: z.array(z.string()).optional(),
    }).optional(),
  )
  .handler(async ({ input, context }) => {
    const start = input?.startDate ? new Date(input.startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = input?.endDate ? new Date(input.endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0);

    const campaignWhere: any = {
      organizationId: context.org.id,
      deletedAt: null,
      ...(input?.campaignIds?.length ? { id: { in: input.campaignIds } } : {}),
    };

    const campaigns = await prisma.nasaCampaignPlanner.findMany({
      where: campaignWhere,
      select: { id: true, title: true, clientName: true, color: true, status: true, startDate: true, endDate: true, companyCode: true },
    });

    const campaignIds = campaigns.map((c) => c.id);

    const events = await prisma.nasaCampaignEvent.findMany({
      where: {
        campaignPlannerId: { in: campaignIds },
        scheduledAt: { gte: start, lte: end },
      },
      orderBy: { scheduledAt: "asc" },
    });

    const tasks = await prisma.nasaCampaignTask.findMany({
      where: {
        campaignPlannerId: { in: campaignIds },
        dueDate: { gte: start, lte: end },
        status: { not: "COMPLETED" },
      },
      orderBy: { dueDate: "asc" },
    });

    return { campaigns, events, tasks };
  });
