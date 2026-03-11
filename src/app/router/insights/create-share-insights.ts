import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { slugify } from "@/lib/utils";

export const createShareInsights = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/insights/share",
    summary: "Create a shareable link for a tracking dashboard",
  })
  .input(
    z.object({
      name: z.string(),
      filters: z.any(),
      settings: z.any(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org, user } = context;
      const { name, filters, settings } = input;

      const token = slugify(name);

      const insightShare = await prisma.insightShares.create({
        data: {
          name,
          token,
          filters: filters as Prisma.InputJsonValue,
          settings: settings as Prisma.InputJsonValue,
          organizationId: org.id,
          userId: user.id,
        },
      });

      return insightShare;
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
