import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireOrgMiddleware } from "../../middlewares/org";
import { LeadSource } from "@/generated/prisma/enums";
import { Lead } from "@/generated/prisma/client";

export const listLeadByWhats = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/leads/by-whats",
    summary: "Get all leads by whats",
  })
  .output(
    z.object({
      leads: z.array(z.custom<Lead>()),
    }),
  )
  .handler(async ({ errors, context }) => {
    try {
      const { org } = context;

      const leads = await prisma.lead.findMany({
        where: {
          tracking: {
            organizationId: org.id,
          },
          source: LeadSource.WHATSAPP,
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
