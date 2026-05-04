import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

export const approvePost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPlannerPost.update({
      where: { id: input.postId, organizationId: context.org.id },
      data: { status: "APPROVED" },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nasa-planner",
      subAppSlug: "planner-posts",
      featureKey: "planner.post.approved",
      action: "planner.post.approved",
      actionLabel: `Aprovou um post`,
      resourceId: post.id,
    });

    return { post };
  });
