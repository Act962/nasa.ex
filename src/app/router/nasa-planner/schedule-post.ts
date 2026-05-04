import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

export const schedulePost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      postId: z.string(),
      scheduledAt: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const scheduledAt = new Date(input.scheduledAt);
    if (scheduledAt < new Date()) {
      throw new ORPCError("BAD_REQUEST", { message: "Data de agendamento deve ser no futuro" });
    }

    const post = await prisma.nasaPlannerPost.update({
      where: { id: input.postId, organizationId: context.org.id },
      data: { status: "SCHEDULED", scheduledAt },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nasa-planner",
      subAppSlug: "planner-posts",
      featureKey: "planner.post.scheduled",
      action: "planner.post.scheduled",
      actionLabel: `Agendou um post para ${scheduledAt.toLocaleDateString("pt-BR")}`,
      resourceId: post.id,
      metadata: { scheduledAt: scheduledAt.toISOString() },
    });

    return { post };
  });
