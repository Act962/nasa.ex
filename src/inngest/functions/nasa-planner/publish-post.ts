import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { NasaPlannerPostStatus } from "@/generated/prisma/enums";
import { createNotification, NOTIF_TYPES } from "@/features/admin/lib/notification-service";
import {
  failStuckPublishing,
  runPublishWorkflow,
  type PublishTrigger,
} from "@/features/nasa-planner/server/publishing/publish-workflow";

/** Publicação do Planner (spec 0057): programada (dorme até a hora) e imediata, pelo mesmo fluxo. */

interface PublishEventData {
  postId: string;
  organizationId: string;
  scheduleVersion: number;
  scheduledAt?: string;
  trigger?: PublishTrigger;
}

async function notifyPublishFailure(postId: string) {
  const post = await prisma.nasaPlannerPost.findUnique({
    where: { id: postId },
    select: { organizationId: true, createdById: true, title: true, publishError: true },
  });
  if (!post) return;
  await createNotification({
    userId: post.createdById,
    organizationId: post.organizationId,
    type: NOTIF_TYPES.PLANNER_PUBLISH_FAILED,
    title: "Um post não foi publicado",
    body: `${post.title ?? "Post sem título"}: ${post.publishError ?? "erro desconhecido"}`,
    appKey: "nasa-planner",
    actionUrl: `/nasa-planner?post=${postId}`,
    severity: "warning",
  });
}

export const publishPlannerPost = inngest.createFunction(
  {
    id: "nasa-planner-publish-post-v2",
    retries: 3,
    concurrency: [{ key: "event.data.organizationId", limit: 3 }],
    onFailure: async ({ event }) => {
      const failedData = event.data.event.data as PublishEventData;
      await failStuckPublishing(failedData.postId, "A publicação parou no meio do caminho. Tente de novo.");
      await notifyPublishFailure(failedData.postId);
    },
  },
  [{ event: "nasa-planner/post.scheduled" }, { event: "nasa-planner/post.publish-now" }],
  async ({ event, step }) => {
    const eventData = event.data as PublishEventData;
    const isScheduled = event.name === "nasa-planner/post.scheduled";
    if (isScheduled && eventData.scheduledAt) {
      await step.sleepUntil("wait-scheduled-time", new Date(eventData.scheduledAt));
    }

    const result = await runPublishWorkflow(step, {
      postId: eventData.postId,
      scheduleVersion: eventData.scheduleVersion,
      trigger: eventData.trigger ?? (isScheduled ? "SCHEDULE" : "PUBLISH_NOW"),
    });
    if ("status" in result && result.status === "FAILED") {
      await step.run("notify-failure", () => notifyPublishFailure(eventData.postId));
    }
    return result;
  },
);

/** Eventos `nasa-planner/publish.post` que já estavam na fila antes da spec 0057 (CB-7). */
export const publishPlannerPostLegacy = inngest.createFunction(
  { id: "nasa-planner-publish-post", retries: 1 },
  { event: "nasa-planner/publish.post" },
  async ({ event, step }) => {
    const { postId } = event.data as { postId: string };
    const post = await step.run("load-post", () =>
      prisma.nasaPlannerPost.findUnique({
        where: { id: postId },
        select: { organizationId: true, scheduleVersion: true, status: true },
      }),
    );
    if (!post || post.status !== NasaPlannerPostStatus.SCHEDULED) return { skipped: true };
    await step.sendEvent("forward-publish-now", {
      name: "nasa-planner/post.publish-now",
      id: `publish-${postId}-v${post.scheduleVersion}`,
      data: { postId, organizationId: post.organizationId, scheduleVersion: post.scheduleVersion, trigger: "SWEEP" },
    });
    return { forwarded: true };
  },
);
