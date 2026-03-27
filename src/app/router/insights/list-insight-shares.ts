import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";

export const listInsightShares = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/insights/shares",
    summary: "List all shared insight reports for the current organization",
  })
  .handler(async ({ errors, context }) => {
    try {
      const { org } = context;

      const shares = await prisma.insightShares.findMany({
        where: {
          organizationId: org.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          name: true,
          token: true,
          createdAt: true,
          organizationId: true,
          createdBy: {
            select: {
              name: true,
              image: true,
            },
          },
        },
      });

      return shares;
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
