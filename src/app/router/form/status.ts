import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";

export const insightForm = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/forms/stats",
    summary: "Fetch aggregated form stats for the current user",
  })
  .handler(async ({ context }) => {
    const { _sum, _count } = await prisma.form.aggregate({
      where: { userId: context.user.id },
      _sum: {
        views: true,
        responses: true,
      },
      _count: {
        id: true,
      },
    });

    const views = _sum.views ?? 0;
    const totalResponses = _sum.responses ?? 0;
    const totalForms = _count?.id ?? 0;

    const conversionRate = views > 0 ? (totalResponses / views) * 100 : 0;
    const engagementRate =
      totalForms > 0 ? (totalResponses / totalForms) * 100 : 0;

    return {
      views,
      totalForms,
      totalResponses,
      conversionRate,
      engagementRate,
    };
  });
