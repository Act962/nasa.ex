import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteWidget = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/widgets/delete",
    summary: "Delete a widget",
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { id } = input;
    const widget = await prisma.widget.delete({
      where: {
        id,
      },
    });
    return widget;
  });
