import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

export const listLeadsAtInsights = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/insights/shares",
    summary: "List all shared insight reports for the current organization",
  })
  .input(
    z.object({
      leadIds: z.array(z.string()),
    }),
  )
  .handler(async ({ errors, input, context }) => {
    try {
      const { leadIds } = input;
      const { org } = context;
      const leads = await prisma.lead.findMany({
        where: {
          id: {
            in: leadIds,
          },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          currentAction: true,
        },
      });
      return leads;
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
