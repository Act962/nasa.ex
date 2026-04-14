import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const sendNotification = base
  .use(requireAdminMiddleware)
  .route({
    method: "POST",
    summary: "Admin — Send notification",
    tags: ["Admin"],
  })
  .input(
    z.object({
      title: z.string().min(1).max(100),
      body: z.string().min(1).max(2000),
      type: z.enum(["info", "warning", "success", "error"]).default("info"),
      targetType: z.enum(["all", "org", "user"]).default("all"),
      targetId: z.string().optional().nullable(),
      actionUrl: z.string().url().optional().nullable(),
      appKey: z.string().optional().nullable(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (
      (input.targetType === "org" || input.targetType === "user") &&
      !input.targetId
    ) {
      throw errors.BAD_REQUEST;
    }

    const notification = await prisma.adminNotification.create({
      data: {
        title: input.title,
        body: input.body,
        type: input.type,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        actionUrl: input.actionUrl ?? null,
        appKey: input.appKey ?? null,
        createdBy: context.adminUser.id,
      },
      select: { id: true },
    });


    return { id: notification.id };
  });
