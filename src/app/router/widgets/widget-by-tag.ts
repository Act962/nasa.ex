import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getWidgetByTag = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/widgets/by-tag",
    summary: "Get leads count by tag",
  })
  .input(
    z.object({
      tagId: z.string(),
      organizationId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const { tagId, organizationId } = input;

    const tag = await prisma.tag.findUnique({
      where: {
        id: tagId,
      },
      select: {
        color: true,
      },
    });

    const count = await prisma.leadTag.count({
      where: {
        tagId: tagId,
        lead: {
          tracking: {
            organizationId: organizationId,
          },
        },
      },
    });

    return { count, color: tag?.color };
  });
