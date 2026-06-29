import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { WidgetType } from "@/generated/prisma/client";
import { z } from "zod";

export const createWidget = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/widgets",
    summary: "Create a widget",
  })
  .input(
    z.object({
      title: z.string(),
      type: z.enum(WidgetType),
      config: z.any(),
      organizationId: z.string(),
      order: z.number(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { title, type, config, organizationId, order } = input;
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new Error("Organization not found");
    }

    const widget = await prisma.widget.create({
      data: {
        title,
        type,
        config,
        order,
        organizationId,
      },
    });
    return widget;
  });
