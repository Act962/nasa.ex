import "server-only";
import { inngest } from "@/inngest/client";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { NasaPlannerPostStatus, NasaPlannerReviewKind } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { createNotification, NOTIF_TYPES, type NotifType } from "@/features/admin/lib/notification-service";
import { getUserAppPermissions } from "@/features/permissions/server/app-permission";
import { canDoPlannerAction, PLANNER_APP_KEY } from "./cross-org";
import { buildBrandChecklist } from "../lib/brand-checklist";
import { getBrandChecklistRulesForPost } from "./brand-kit/brand-kits";
import { schedulePlannerPost, unschedulePlannerPost } from "./scheduling";

/** Fluxo de aprovação do Planner (spec 0058, RF-3): cada passo vira uma linha de histórico e avisa quem precisa agir. */

const SUBMITTABLE_STATUSES: NasaPlannerPostStatus[] = [
  NasaPlannerPostStatus.IDEA,
  NasaPlannerPostStatus.DRAFT,
  NasaPlannerPostStatus.CHANGES_REQUESTED,
];
const REVIEWABLE_STATUSES: NasaPlannerPostStatus[] = [NasaPlannerPostStatus.PENDING_APPROVAL, NasaPlannerPostStatus.CHANGES_REQUESTED];
const APPROVED_STATUSES: NasaPlannerPostStatus[] = [NasaPlannerPostStatus.APPROVED, NasaPlannerPostStatus.SCHEDULED];

async function notifyUsers(userIds: string[], notification: { organizationId: string; type: NotifType; title: string; body: string; postId: string }) {
  await Promise.all(
    [...new Set(userIds)].map((userId) =>
      createNotification({
        userId,
        organizationId: notification.organizationId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        appKey: PLANNER_APP_KEY,
        actionUrl: `/nasa-planner?post=${notification.postId}`,
      }).catch((error) => console.warn("[planner-approval] notificação falhou", error)),
    ),
  );
}

async function listApproverIds(organizationId: string, excludeUserId: string) {
  const members = await prisma.member.findMany({ where: { organizationId }, select: { userId: true } });
  const approverChecks = await Promise.all(
    members.map(async ({ userId }) => ({
      userId,
      isApprover: canDoPlannerAction(await getUserAppPermissions(organizationId, userId, PLANNER_APP_KEY), "approve"),
    })),
  );
  return approverChecks.filter((check) => check.isApprover && check.userId !== excludeUserId).map((check) => check.userId);
}

function postLabel(post: { title: string | null; type: string }) {
  return post.title?.trim() || `Post (${post.type.toLowerCase()})`;
}

export async function submitPostForApproval(input: { postId: string; actorId: string; reviewerId?: string; note?: string }) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: input.postId }, include: { planner: true, slides: true } });
  if (!SUBMITTABLE_STATUSES.includes(post.status)) {
    throw new ORPCError("BAD_REQUEST", { message: "Este post já está em aprovação ou aprovado." });
  }
  const checklist = buildBrandChecklist(post, await getBrandChecklistRulesForPost(post));
  const now = new Date();
  await prisma.nasaPlannerPost.update({
    where: { id: post.id },
    data: { status: NasaPlannerPostStatus.PENDING_APPROVAL, submittedAt: now, submittedById: input.actorId, reviewerId: input.reviewerId ?? null },
  });
  await prisma.nasaPlannerPostReview.create({
    data: { postId: post.id, organizationId: post.organizationId, authorId: input.actorId, kind: NasaPlannerReviewKind.SUBMITTED, body: input.note, checklist: checklist as unknown as Prisma.InputJsonValue },
  });
  const reviewerIds = input.reviewerId ? [input.reviewerId] : await listApproverIds(post.organizationId, input.actorId);
  await notifyUsers(reviewerIds, {
    organizationId: post.organizationId,
    type: NOTIF_TYPES.PLANNER_APPROVAL_PENDING,
    title: "Conteúdo esperando sua aprovação",
    body: `${postLabel(post)} foi enviado para aprovação.`,
    postId: post.id,
  });
  // Aprovador com número no Astro recebe a prévia no WhatsApp (spec 0064, RF-4). Best-effort.
  await inngest
    .send({ name: "nasa-planner/approval.whatsapp-notify", data: { postId: post.id, approverIds: input.reviewerId ? [input.reviewerId] : await listApproverIds(post.organizationId, "") } })
    .catch((error: unknown) => console.warn("[planner/approval] aviso no WhatsApp não enfileirado", error));
  return { checklist };
}

export async function requestPostChanges(input: { postId: string; actorId: string; body: string; slideId?: string }) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: input.postId } });
  if (!REVIEWABLE_STATUSES.includes(post.status) && !APPROVED_STATUSES.includes(post.status)) {
    throw new ORPCError("BAD_REQUEST", { message: "Só dá para pedir ajustes em conteúdo enviado para aprovação." });
  }
  if (post.status === NasaPlannerPostStatus.SCHEDULED) await unschedulePlannerPost(post.id, NasaPlannerPostStatus.CHANGES_REQUESTED);
  await prisma.nasaPlannerPost.update({
    where: { id: post.id },
    data: { status: NasaPlannerPostStatus.CHANGES_REQUESTED, changesRequestedAt: new Date(), approvedAt: null, approvedById: null },
  });
  await prisma.nasaPlannerPostReview.create({
    data: { postId: post.id, organizationId: post.organizationId, authorId: input.actorId, kind: NasaPlannerReviewKind.CHANGES_REQUESTED, body: input.body, slideId: input.slideId },
  });
  await notifyUsers([post.submittedById ?? post.createdById], {
    organizationId: post.organizationId,
    type: NOTIF_TYPES.PLANNER_CHANGES_REQUESTED,
    title: "Ajustes pedidos no conteúdo",
    body: `${postLabel(post)}: ${input.body}`,
    postId: post.id,
  });
}

/** Primeira aprovação vale; a segunda vira comentário (spec 0058, CB-6). */
export async function approvePost(input: { postId: string; actorId: string; note?: string; checklist?: Record<string, boolean>; scheduleAt?: Date }) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: input.postId } });
  const isAlreadyApproved = APPROVED_STATUSES.includes(post.status);
  if (!isAlreadyApproved) {
    const approved = await prisma.nasaPlannerPost.updateMany({
      where: { id: post.id, status: { in: [...REVIEWABLE_STATUSES, ...SUBMITTABLE_STATUSES] } },
      data: { status: NasaPlannerPostStatus.APPROVED, approvedAt: new Date(), approvedById: input.actorId },
    });
    if (approved.count === 0) throw new ORPCError("BAD_REQUEST", { message: "Este post não está em aprovação." });
  }
  await prisma.nasaPlannerPostReview.create({
    data: {
      postId: post.id,
      organizationId: post.organizationId,
      authorId: input.actorId,
      kind: isAlreadyApproved ? NasaPlannerReviewKind.COMMENT : NasaPlannerReviewKind.APPROVED,
      body: input.note,
      checklist: input.checklist,
    },
  });
  if (!isAlreadyApproved) {
    await notifyUsers([post.submittedById ?? post.createdById].filter((userId) => userId !== input.actorId), {
      organizationId: post.organizationId,
      type: NOTIF_TYPES.PLANNER_POST_APPROVED,
      title: "Conteúdo aprovado",
      body: `${postLabel(post)} foi aprovado.`,
      postId: post.id,
    });
  }
  if (input.scheduleAt) await schedulePlannerPost(post.id, input.scheduleAt);
}

export async function commentOnPost(input: { postId: string; actorId: string; body: string; slideId?: string }) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: input.postId }, select: { organizationId: true } });
  return prisma.nasaPlannerPostReview.create({
    data: { postId: input.postId, organizationId: post.organizationId, authorId: input.actorId, kind: NasaPlannerReviewKind.COMMENT, body: input.body, slideId: input.slideId },
  });
}

/** Mídia ou legenda mudou depois de aprovado: volta a rascunho e sai do horário (spec 0058, RF-2). */
export async function reopenPostAfterEdit(postId: string, actorId: string) {
  const post = await prisma.nasaPlannerPost.findUnique({ where: { id: postId }, select: { status: true, organizationId: true } });
  if (!post || !APPROVED_STATUSES.includes(post.status)) return false;
  if (post.status === NasaPlannerPostStatus.SCHEDULED) await unschedulePlannerPost(postId, NasaPlannerPostStatus.DRAFT);
  await prisma.nasaPlannerPost.update({
    where: { id: postId },
    data: { status: NasaPlannerPostStatus.DRAFT, approvedAt: null, approvedById: null },
  });
  await prisma.nasaPlannerPostReview.create({
    data: { postId, organizationId: post.organizationId, authorId: actorId, kind: NasaPlannerReviewKind.REOPENED, body: "Editado depois de aprovado: precisa de nova aprovação." },
  });
  return true;
}
