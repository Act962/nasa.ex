import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const listFormResponsesByLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List form responses linked to a lead",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const responses = await prisma.formResponses.findMany({
        where: { leadId: input.leadId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          jsonResponse: true,
          form: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      return { responses };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
