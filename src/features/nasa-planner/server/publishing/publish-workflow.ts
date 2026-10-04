import "server-only";
import type { GetStepTools } from "inngest";
import type { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { meter } from "@/features/stars/lib/metering/meter";
import { NasaPlannerPostStatus, NasaPlannerPublishNetwork } from "@/generated/prisma/enums";
import {
  createIgContainer,
  getIgContainerStatus,
  getIgMediaPermalink,
  publishFbPagePhoto,
  publishFbPagePhotoStory,
  publishFbPageVideo,
  publishIgContainer,
} from "@/http/meta/planner-graph";
import { attachCommentsAutomationAfterPublish } from "../comments-link";
import { classifyPublishError } from "./meta-errors";
import { markPublishAccountError } from "./publish-accounts";
import { buildPublishPlan, loadTargetToken, toContainerParams, type PublishPlan, type PublishTarget } from "./resolve-targets";

/**
 * O único caminho de publicação do Planner (spec 0057, RF-4): programado, "publicar agora", retry e varredura.
 * Claim por `scheduleVersion` impede publicação dupla; rede com id externo gravado nunca é refeita (RF-9).
 */

export type PublishTrigger = "SCHEDULE" | "PUBLISH_NOW" | "RETRY" | "SWEEP";
type StepTools = GetStepTools<typeof inngest>;
type NetworkOutcome = { ok: true } | { ok: false; code: string; message: string };

const PROCESSING_POLL_INTERVAL = "15s";
const PROCESSING_MAX_CHECKS = 40;

interface WorkflowInput {
  postId: string;
  scheduleVersion: number;
  trigger: PublishTrigger;
}

async function recordAttempt(input: {
  postId: string;
  organizationId: string;
  network: NasaPlannerPublishNetwork;
  scheduleVersion: number;
  trigger: PublishTrigger;
  step: "CONTAINER" | "POLL" | "PUBLISH";
  containerId?: string;
  externalId?: string;
  error?: { code: string; message: string };
}) {
  await prisma.nasaPlannerPublishAttempt.create({
    data: {
      postId: input.postId,
      organizationId: input.organizationId,
      network: input.network,
      scheduleVersion: input.scheduleVersion,
      trigger: input.trigger,
      step: input.step,
      containerId: input.containerId,
      externalId: input.externalId,
      status: input.error ? "ERROR" : "OK",
      errorCode: input.error?.code,
      errorMessage: input.error?.message,
    },
  });
}

/** Erro retentável sobe para o Inngest repetir o passo; o resto vira resultado de falha. */
async function handleNetworkError(error: unknown, target: PublishTarget): Promise<{ code: string; message: string }> {
  const classified = classifyPublishError(error);
  if (target.source === "account" && (classified.needsReconnect || classified.code === "PUBLISH_LIMIT")) {
    await markPublishAccountError(target.accountId, classified.code, classified.message, classified.needsReconnect);
  }
  if (classified.isRetryable) throw error;
  return { code: classified.code, message: classified.message };
}

async function publishToInstagram(step: StepTools, plan: PublishPlan, input: WorkflowInput): Promise<NetworkOutcome> {
  const instagram = plan.instagram!;
  const attemptBase = { postId: input.postId, organizationId: plan.organizationId, network: NasaPlannerPublishNetwork.INSTAGRAM, scheduleVersion: input.scheduleVersion, trigger: input.trigger };

  const container = await step.run("ig-container", async () => {
    try {
      const accessToken = await loadTargetToken(plan.organizationId, instagram.target);
      const igUserId = instagram.target.externalTargetId;
      let containerId: string;
      if (instagram.media.kind === "CAROUSEL") {
        const childrenIds: string[] = [];
        for (const item of instagram.media.items) {
          childrenIds.push(await createIgContainer(accessToken, igUserId, { kind: "CAROUSEL_ITEM", ...item }));
        }
        containerId = await createIgContainer(accessToken, igUserId, { kind: "CAROUSEL", childrenIds, caption: plan.caption });
      } else {
        containerId = await createIgContainer(accessToken, igUserId, toContainerParams(instagram.media, plan.caption));
      }
      await recordAttempt({ ...attemptBase, step: "CONTAINER", containerId });
      return { ok: true as const, containerId };
    } catch (error) {
      const failure = await handleNetworkError(error, instagram.target);
      await recordAttempt({ ...attemptBase, step: "CONTAINER", error: failure });
      return { ok: false as const, ...failure };
    }
  });
  if (!container.ok) return container;

  if (instagram.needsProcessing) {
    let isReady = false;
    for (let checkIndex = 0; checkIndex < PROCESSING_MAX_CHECKS && !isReady; checkIndex++) {
      await step.sleep(`ig-wait-${checkIndex}`, PROCESSING_POLL_INTERVAL);
      const status = await step.run(`ig-status-${checkIndex}`, async () => {
        const accessToken = await loadTargetToken(plan.organizationId, instagram.target);
        return getIgContainerStatus(accessToken, container.containerId);
      });
      if (status.statusCode === "FINISHED") isReady = true;
      if (status.statusCode === "ERROR" || status.statusCode === "EXPIRED") {
        const failure = { code: `CONTAINER_${status.statusCode}`, message: `A Meta não conseguiu processar o vídeo${status.detail ? `: ${status.detail}` : "."}` };
        await step.run("ig-processing-failed", () => recordAttempt({ ...attemptBase, step: "POLL", containerId: container.containerId, error: failure }));
        return { ok: false, ...failure };
      }
    }
    if (!isReady) {
      const failure = { code: "PROCESSING_TIMEOUT", message: "A Meta não terminou de processar o vídeo a tempo. Tente de novo." };
      await step.run("ig-processing-timeout", () => recordAttempt({ ...attemptBase, step: "POLL", containerId: container.containerId, error: failure }));
      return { ok: false, ...failure };
    }
  }

  return step.run("ig-publish", async () => {
    try {
      const accessToken = await loadTargetToken(plan.organizationId, instagram.target);
      const mediaId = await publishIgContainer(accessToken, instagram.target.externalTargetId, container.containerId);
      const permalink = await getIgMediaPermalink(accessToken, mediaId);
      // Grava na hora: se o resto falhar, o retry não publica de novo no Instagram (RF-9).
      await prisma.nasaPlannerPost.update({
        where: { id: input.postId },
        data: { externalIgPostId: mediaId, externalIgPermalink: permalink },
      });
      await recordAttempt({ ...attemptBase, step: "PUBLISH", containerId: container.containerId, externalId: mediaId });
      return { ok: true as const };
    } catch (error) {
      const failure = await handleNetworkError(error, instagram.target);
      await recordAttempt({ ...attemptBase, step: "PUBLISH", containerId: container.containerId, error: failure });
      return { ok: false as const, ...failure };
    }
  });
}

async function publishToFacebook(step: StepTools, plan: PublishPlan, input: WorkflowInput): Promise<NetworkOutcome> {
  const facebook = plan.facebook!;
  const attemptBase = { postId: input.postId, organizationId: plan.organizationId, network: NasaPlannerPublishNetwork.FACEBOOK, scheduleVersion: input.scheduleVersion, trigger: input.trigger };
  return step.run("fb-publish", async () => {
    try {
      const accessToken = await loadTargetToken(plan.organizationId, facebook.target);
      const pageId = facebook.target.externalTargetId;
      const media = facebook.media;
      const fbPostId =
        media.kind === "PHOTO"
          ? await publishFbPagePhoto(accessToken, pageId, media.imageUrl, plan.caption)
          : media.kind === "PHOTO_STORY"
            ? await publishFbPagePhotoStory(accessToken, pageId, media.imageUrl)
            : await publishFbPageVideo(accessToken, pageId, media.kind === "REEL" ? "video_reels" : "video_stories", media.videoUrl, plan.caption);
      await prisma.nasaPlannerPost.update({ where: { id: input.postId }, data: { externalFbPostId: fbPostId } });
      await recordAttempt({ ...attemptBase, step: "PUBLISH", externalId: fbPostId });
      return { ok: true as const };
    } catch (error) {
      const failure = await handleNetworkError(error, facebook.target);
      await recordAttempt({ ...attemptBase, step: "PUBLISH", error: failure });
      return { ok: false as const, ...failure };
    }
  });
}

/** Encerra o post: PUBLISHED só com id externo em todas as redes pedidas (RF-8); cobra Stars só no sucesso (RF-13). */
async function finalizePublish(postId: string, failures: Array<{ code: string; message: string }>) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({
    where: { id: postId },
    select: { organizationId: true, createdById: true, targetNetworks: true, externalIgPostId: true, externalFbPostId: true },
  });
  const isEveryNetworkPublished =
    post.targetNetworks.length > 0 &&
    post.targetNetworks.every((network) => (network === "INSTAGRAM" ? post.externalIgPostId : network === "FACEBOOK" ? post.externalFbPostId : true));

  if (!isEveryNetworkPublished) {
    const firstFailure = failures[0] ?? { code: "NOT_PUBLISHED", message: "Nada foi publicado. Confira as contas conectadas." };
    await prisma.nasaPlannerPost.update({
      where: { id: postId },
      data: {
        status: NasaPlannerPostStatus.FAILED,
        publishError: failures.map((failure) => failure.message).join(" ") || firstFailure.message,
        publishErrorCode: firstFailure.code,
      },
    });
    return { status: "FAILED" as const };
  }

  const charge = await meter({
    organizationId: post.organizationId,
    action: "planner_post_publish",
    userId: post.createdById,
    appSlug: "nasa-planner",
    description: "ÓRBITA Planner — publicação de post",
    feature: "planner.post.publish",
  });
  await prisma.nasaPlannerPost.update({
    where: { id: postId },
    data: {
      status: NasaPlannerPostStatus.PUBLISHED,
      publishedAt: new Date(),
      publishError: null,
      publishErrorCode: null,
      ...(charge.charged && charge.success && { starsSpent: { increment: charge.cost } }),
    },
  });
  return { status: "PUBLISHED" as const };
}

export async function claimPostForPublishing(postId: string, scheduleVersion: number) {
  const claimed = await prisma.nasaPlannerPost.updateMany({
    where: { id: postId, scheduleVersion, status: NasaPlannerPostStatus.SCHEDULED },
    data: { status: NasaPlannerPostStatus.PUBLISHING, publishingStartedAt: new Date(), publishAttempts: { increment: 1 } },
  });
  return claimed.count === 1;
}

export async function runPublishWorkflow(step: StepTools, input: WorkflowInput) {
  const isClaimed = await step.run("claim", () => claimPostForPublishing(input.postId, input.scheduleVersion));
  if (!isClaimed) return { skipped: true as const };

  const plan = await step.run("plan", () => buildPublishPlan(input.postId));
  const failures: Array<{ code: string; message: string }> = plan.problems.map((message) => ({ code: "INVALID_POST", message }));

  if (plan.problems.length === 0) {
    if (plan.instagram) {
      const outcome = await publishToInstagram(step, plan, input);
      if (!outcome.ok) failures.push(outcome);
    }
    if (plan.facebook) {
      const outcome = await publishToFacebook(step, plan, input);
      if (!outcome.ok) failures.push(outcome);
    }
  }

  const result = await step.run("finalize", () => finalizePublish(input.postId, failures));
  if (result.status === "PUBLISHED") await runAfterPublished(step, input.postId);
  return result;
}

/** Efeitos depois de publicar (spec 0059): ligar a automação do Comments. Best-effort — o post já saiu. */
async function runAfterPublished(step: StepTools, postId: string) {
  await step.run("after-published-comments", async () => {
    try {
      await attachCommentsAutomationAfterPublish(postId);
    } catch (error) {
      console.error("[planner/publish] automação do Comments não foi ligada:", postId, error);
    }
  });
}

/** Função esgotou as tentativas no meio do caminho: o post não pode ficar preso em PUBLISHING. */
export async function failStuckPublishing(postId: string, message: string) {
  await prisma.nasaPlannerPost.updateMany({
    where: { id: postId, status: NasaPlannerPostStatus.PUBLISHING },
    data: { status: NasaPlannerPostStatus.FAILED, publishError: message, publishErrorCode: "WORKFLOW_FAILED" },
  });
}
