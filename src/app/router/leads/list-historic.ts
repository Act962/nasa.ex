import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const listHistoric = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List historic of a lead",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const historic = await prisma.leadHistory.findMany({
        where: {
          leadId: input.leadId,
        },
        select: {
          id: true,
          action: true,
          notes: true,
          createdAt: true,
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return { historic };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
