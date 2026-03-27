import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateWidget = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/widgets/update",
    summary: "Update a widget",
  })
  .input(
    z.object({
      id: z.string(),
      title: z.string().optional(),
      config: z.any().optional(),
      order: z.number().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { id, title, config, order } = input;
    const widget = await prisma.widget.update({
      where: {
        id,
      },
      data: {
        title,
        config,
        order,
      },
    });
    return widget;
  });
