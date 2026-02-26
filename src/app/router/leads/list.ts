import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { requireOrgMiddleware } from "../../middlewares/org";

export const listLead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/leads",
    summary: "Get all leads",
  })

  .handler(async ({ errors, context }) => {
    try {
      const { org } = context;

      const leads = await prisma.lead.findMany({
        where: {
          tracking: {
            organizationId: org.id,
          },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          createdAt: true,
          profile: true,
          tracking: {
            select: {
              id: true,
              name: true,
            },
          },
          status: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return {
        leads,
      };
    } catch (error) {
      console.log(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
