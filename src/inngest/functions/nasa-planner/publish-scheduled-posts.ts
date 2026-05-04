import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { NasaPlannerPostStatus } from "@/generated/prisma/enums";

export const publishScheduledPosts = inngest.createFunction(
  { id: "nasa-planner-publish-scheduled-posts", retries: 1 },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    const now = new Date();

    const duePosts = await step.run("fetch-due-posts", async () => {
      return prisma.nasaPlannerPost.findMany({
        where: {
          status: NasaPlannerPostStatus.SCHEDULED,
          scheduledAt: { lte: now },
        },
        select: { id: true, organizationId: true, scheduledAt: true },
        take: 100,
      });
    });

    if (duePosts.length === 0) return { dispatched: 0 };

    // Dispatch individual publish events for each post
    await step.run("dispatch-publish-events", async () => {
      await inngest.send(
        duePosts.map((post) => ({
          name: "nasa-planner/publish.post" as const,
          data: {
            postId: post.id,
            organizationId: post.organizationId,
            scheduledAt: post.scheduledAt ? new Date(post.scheduledAt as any).toISOString() : undefined,
          },
        })),
      );
    });

    return { dispatched: duePosts.length };
  },
);
