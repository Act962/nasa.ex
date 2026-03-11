import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

export const deleteInsight = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/insights/public/:organizationId/:slug",
    summary:
      "Get a public tracking dashboard report by organization and insight slug (no auth required)",
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ errors, context, input }) => {
    const insight = await prisma.insightShares.findUnique({
      where: { id: input.id },
      select: {
        id: true,
      },
    });

    if (!insight?.id) {
      throw errors.BAD_REQUEST({ message: "Insight não existe" });
    }
    try {
      await prisma.insightShares.delete({
        where: {
          id: input.id,
        },
      });
    } catch (error) {
      console.log(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
