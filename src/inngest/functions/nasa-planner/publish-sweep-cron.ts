import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { NasaPlannerPostStatus } from "@/generated/prisma/enums";
import { failStuckPublishing } from "@/features/nasa-planner/server/publishing/publish-workflow";

/** Rede de segurança (spec 0057, RF-6): programados que passaram da hora e posts presos em PUBLISHING. */

const OVERDUE_GRACE_MS = 3 * 60 * 1000;
const STUCK_PUBLISHING_MS = 20 * 60 * 1000;
const SWEEP_BATCH_SIZE = 100;

export const plannerPublishSweep = inngest.createFunction(
  { id: "nasa-planner-publish-sweep", retries: 1 },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    const overduePosts = await step.run("find-overdue", () =>
      prisma.nasaPlannerPost.findMany({
        where: { status: NasaPlannerPostStatus.SCHEDULED, scheduledAt: { lte: new Date(Date.now() - OVERDUE_GRACE_MS) } },
        select: { id: true, organizationId: true, scheduleVersion: true },
        take: SWEEP_BATCH_SIZE,
      }),
    );
    if (overduePosts.length > 0) {
      // O `id` do evento deduplica: se o evento original ainda for rodar, o Inngest descarta este.
      await step.sendEvent(
        "publish-overdue",
        overduePosts.map((post) => ({
          name: "nasa-planner/post.publish-now" as const,
          id: `publish-${post.id}-v${post.scheduleVersion}`,
          data: { postId: post.id, organizationId: post.organizationId, scheduleVersion: post.scheduleVersion, trigger: "SWEEP" },
        })),
      );
    }

    const stuckPosts = await step.run("find-stuck", () =>
      prisma.nasaPlannerPost.findMany({
        where: { status: NasaPlannerPostStatus.PUBLISHING, publishingStartedAt: { lte: new Date(Date.now() - STUCK_PUBLISHING_MS) } },
        select: { id: true },
        take: SWEEP_BATCH_SIZE,
      }),
    );
    for (const stuckPost of stuckPosts) {
      await step.run(`fail-stuck-${stuckPost.id}`, () =>
        failStuckPublishing(stuckPost.id, "A publicação demorou demais e foi interrompida. Tente de novo."),
      );
    }
    return { overdue: overduePosts.length, stuck: stuckPosts.length };
  },
);
