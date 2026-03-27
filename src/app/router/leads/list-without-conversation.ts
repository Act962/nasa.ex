import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { requireOrgMiddleware } from "../../middlewares/org";
import z from "zod";

export const listLeadWithoutConversation = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/leads",
    summary: "Get all leads",
  })
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ errors, context, input }) => {
    try {
      const { org } = context;
      const { trackingId } = input;

      const leads = await prisma.lead.findMany({
        where: {
          trackingId,
          conversation: { is: null },
        },
        select: {
          id: true,
          name: true,
          phone: true,
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
        customers: leads,
      };
    } catch (error) {
      console.log(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
