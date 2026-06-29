import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const listPlanners = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const planners = await prisma.nasaPlanner.findMany({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "desc" },
      include: {
        orgProject: { select: { id: true, name: true, color: true, type: true } },
        _count: {
          select: {
            posts: true,
            mindMaps: true,
            campaignPlanners: { where: { deletedAt: null } },
          },
        },
      },
    });

    return { planners };
  });
