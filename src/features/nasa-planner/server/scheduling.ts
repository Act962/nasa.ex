import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { NasaPlannerPostStatus } from "@/generated/prisma/enums";
import { isApprovalRequired } from "./cross-org";
import { resolveInstagramTarget } from "./publishing/instagram-channels";
import { validatePostForPublishing } from "./publishing/validate-post";
import type { PublishTrigger } from "./publishing/publish-workflow";

/**
 * Programar, desprogramar e publicar agora (spec 0057, RF-5). Cada programação incrementa `scheduleVersion`:
 * o evento de uma versão antiga acorda, não consegue o claim e não publica — não há cancelamento por evento,
 * que podia chegar depois e derrubar a execução nova.
 * Usado pelas procedures, pelo Astro e pelo MCP — a regra de aprovação vale para todos.
 */

const SCHEDULABLE_STATUSES: NasaPlannerPostStatus[] = [
  NasaPlannerPostStatus.APPROVED,
  NasaPlannerPostStatus.SCHEDULED,
  NasaPlannerPostStatus.FAILED,
];
const SCHEDULABLE_WITHOUT_APPROVAL: NasaPlannerPostStatus[] = [
  ...SCHEDULABLE_STATUSES,
  NasaPlannerPostStatus.IDEA,
  NasaPlannerPostStatus.DRAFT,
  NasaPlannerPostStatus.CHANGES_REQUESTED,
  NasaPlannerPostStatus.PENDING_APPROVAL,
];

async function loadSchedulablePost(postId: string) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({
    where: { id: postId },
    include: { slides: { select: { imageKey: true, videoKey: true } }, planner: { select: { requiresApproval: true } } },
  });
  const requiresApproval = await isApprovalRequired(post.organizationId, post.planner.requiresApproval);
  const allowedStatuses = requiresApproval ? SCHEDULABLE_STATUSES : SCHEDULABLE_WITHOUT_APPROVAL;
  if (!allowedStatuses.includes(post.status)) {
    const message =
      post.status === NasaPlannerPostStatus.PUBLISHED || post.status === NasaPlannerPostStatus.PUBLISHING
        ? "Este post já foi publicado."
        : "Envie para aprovação primeiro: só conteúdo aprovado pode ser programado.";
    throw new ORPCError("BAD_REQUEST", { message });
  }
  const problems = validatePostForPublishing({ ...post, targetNetworks: post.targetNetworks ?? [] });
  if (problems.length > 0) throw new ORPCError("BAD_REQUEST", { message: problems.join(" ") });
  // Conta conferida já no pedido, não só no horário de publicar (spec 0074, RF-19).
  if (post.targetNetworks.includes("INSTAGRAM") && !post.externalIgPostId) {
    const instagramTarget = await resolveInstagramTarget(post.organizationId, post.targetIgAccountId);
    if (!instagramTarget.ok) throw new ORPCError("BAD_REQUEST", { message: instagramTarget.problem });
  }
  return post;
}

export async function schedulePlannerPost(postId: string, scheduledAt: Date) {
  if (scheduledAt.getTime() < Date.now() - 60_000) {
    throw new ORPCError("BAD_REQUEST", { message: "Escolha um horário no futuro. Para publicar já, use \"Publicar agora\"." });
  }
  await loadSchedulablePost(postId);
  const scheduledPost = await prisma.nasaPlannerPost.update({
    where: { id: postId },
    data: {
      status: NasaPlannerPostStatus.SCHEDULED,
      scheduledAt,
      scheduleVersion: { increment: 1 },
      publishError: null,
      publishErrorCode: null,
    },
  });
  await inngest.send({
    name: "nasa-planner/post.scheduled",
    id: `schedule-${postId}-v${scheduledPost.scheduleVersion}`,
    data: {
      postId,
      organizationId: scheduledPost.organizationId,
      scheduleVersion: scheduledPost.scheduleVersion,
      scheduledAt: scheduledAt.toISOString(),
    },
  });
  return scheduledPost;
}

/** Volta para APPROVED (ou DRAFT, quando editado); a execução pendente perde a versão e não publica. */
export async function unschedulePlannerPost(postId: string, nextStatus: NasaPlannerPostStatus = NasaPlannerPostStatus.APPROVED) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: postId }, select: { status: true } });
  if (post.status !== NasaPlannerPostStatus.SCHEDULED) return null;
  const unscheduledPost = await prisma.nasaPlannerPost.update({
    where: { id: postId },
    data: { status: nextStatus, scheduleVersion: { increment: 1 } },
  });
  return unscheduledPost;
}

/** "Publicar agora" e "Tentar novamente": mesmo fluxo, sem esperar (D-2 da spec 0057). */
export async function requestImmediatePublish(postId: string, trigger: Extract<PublishTrigger, "PUBLISH_NOW" | "RETRY">) {
  await loadSchedulablePost(postId);
  const queuedPost = await prisma.nasaPlannerPost.update({
    where: { id: postId },
    data: {
      status: NasaPlannerPostStatus.SCHEDULED,
      scheduledAt: new Date(),
      scheduleVersion: { increment: 1 },
      publishError: null,
      publishErrorCode: null,
    },
  });
  await inngest.send({
    name: "nasa-planner/post.publish-now",
    id: `publish-${postId}-v${queuedPost.scheduleVersion}`,
    data: { postId, organizationId: queuedPost.organizationId, scheduleVersion: queuedPost.scheduleVersion, trigger },
  });
  return queuedPost;
}
