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

export const SUBMITTABLE_STATUSES: NasaPlannerPostStatus[] = [
  NasaPlannerPostStatus.IDEA,
  NasaPlannerPostStatus.DRAFT,
  NasaPlannerPostStatus.CHANGES_REQUESTED,
];
export const REVIEWABLE_STATUSES: NasaPlannerPostStatus[] = [NasaPlannerPostStatus.PENDING_APPROVAL, NasaPlannerPostStatus.CHANGES_REQUESTED];
export const APPROVED_STATUSES: NasaPlannerPostStatus[] = [NasaPlannerPostStatus.APPROVED, NasaPlannerPostStatus.SCHEDULED];

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

/**
 * `groupPostIds` (spec 0074, RF-7): outras contas do mesmo conteúdo que recebem a mesma transição. As escritas
 * de todos os posts vão numa transação só — falhou um, nenhum muda — e o aviso sai uma vez, depois do commit.
 */
export async function submitPostForApproval(input: { postId: string; actorId: string; reviewerId?: string; note?: string; groupPostIds?: string[] }) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: input.postId }, include: { planner: true, slides: true } });
  if (!SUBMITTABLE_STATUSES.includes(post.status)) {
    throw new ORPCError("BAD_REQUEST", { message: "Este post já está em aprovação ou aprovado." });
  }
  const groupPosts = input.groupPostIds?.length
    ? await prisma.nasaPlannerPost.findMany({
        where: { id: { in: input.groupPostIds, not: post.id }, status: { in: SUBMITTABLE_STATUSES } },
        include: { planner: true, slides: true },
      })
    : [];
  // O checklist é por conta: cada post usa o kit da conta em que sai (spec 0070).
  const submissions = await Promise.all(
    [post, ...groupPosts].map(async (submittedPost) => ({
      submittedPost,
      checklist: buildBrandChecklist(submittedPost, await getBrandChecklistRulesForPost(submittedPost)),
    })),
  );
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const { submittedPost, checklist } of submissions) {
      await tx.nasaPlannerPost.update({
        where: { id: submittedPost.id },
        data: { status: NasaPlannerPostStatus.PENDING_APPROVAL, submittedAt: now, submittedById: input.actorId, reviewerId: input.reviewerId ?? null },
      });
      await tx.nasaPlannerPostReview.create({
        data: { postId: submittedPost.id, organizationId: submittedPost.organizationId, authorId: input.actorId, kind: NasaPlannerReviewKind.SUBMITTED, body: input.note, checklist: checklist as unknown as Prisma.InputJsonValue },
      });
    }
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
  return { checklist: submissions[0].checklist };
}

export async function requestPostChanges(input: { postId: string; actorId: string; body: string; slideId?: string; groupPostIds?: string[] }) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: input.postId } });
  const changeableStatuses = [...REVIEWABLE_STATUSES, ...APPROVED_STATUSES];
  if (!changeableStatuses.includes(post.status)) {
    throw new ORPCError("BAD_REQUEST", { message: "Só dá para pedir ajustes em conteúdo enviado para aprovação." });
  }
  const groupPosts = input.groupPostIds?.length
    ? await prisma.nasaPlannerPost.findMany({ where: { id: { in: input.groupPostIds, not: post.id }, status: { in: changeableStatuses } } })
    : [];
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const reviewedPost of [post, ...groupPosts]) {
      await tx.nasaPlannerPost.update({
        where: { id: reviewedPost.id },
        data: {
          status: NasaPlannerPostStatus.CHANGES_REQUESTED,
          changesRequestedAt: now,
          approvedAt: null,
          approvedById: null,
          // Post programado sai do horário: a execução pendente perde a versão e não publica (mesma regra de `unschedulePlannerPost`).
          ...(reviewedPost.status === NasaPlannerPostStatus.SCHEDULED && { scheduleVersion: { increment: 1 } }),
        },
      });
      await tx.nasaPlannerPostReview.create({
        data: {
          postId: reviewedPost.id,
          organizationId: reviewedPost.organizationId,
          authorId: input.actorId,
          kind: NasaPlannerReviewKind.CHANGES_REQUESTED,
          body: input.body,
          slideId: reviewedPost.id === post.id ? input.slideId : undefined,
        },
      });
    }
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
export async function approvePost(input: { postId: string; actorId: string; note?: string; checklist?: Record<string, boolean>; scheduleAt?: Date; groupPostIds?: string[] }) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: input.postId } });
  const isAlreadyApproved = APPROVED_STATUSES.includes(post.status);
  const approvableStatuses = [...REVIEWABLE_STATUSES, ...SUBMITTABLE_STATUSES];
  // Irmão já aprovado fica como está (spec 0074, CB-4): só os que ainda esperam decisão entram.
  const groupPosts = input.groupPostIds?.length
    ? await prisma.nasaPlannerPost.findMany({ where: { id: { in: input.groupPostIds, not: post.id }, status: { in: approvableStatuses } }, select: { id: true, organizationId: true } })
    : [];
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (!isAlreadyApproved) {
      const approved = await tx.nasaPlannerPost.updateMany({
        where: { id: post.id, status: { in: approvableStatuses } },
        data: { status: NasaPlannerPostStatus.APPROVED, approvedAt: now, approvedById: input.actorId },
      });
      if (approved.count === 0) throw new ORPCError("BAD_REQUEST", { message: "Este post não está em aprovação." });
    }
    await tx.nasaPlannerPostReview.create({
      data: {
        postId: post.id,
        organizationId: post.organizationId,
        authorId: input.actorId,
        kind: isAlreadyApproved ? NasaPlannerReviewKind.COMMENT : NasaPlannerReviewKind.APPROVED,
        body: input.note,
        checklist: input.checklist,
      },
    });
    for (const groupPost of groupPosts) {
      const approved = await tx.nasaPlannerPost.updateMany({
        where: { id: groupPost.id, status: { in: approvableStatuses } },
        data: { status: NasaPlannerPostStatus.APPROVED, approvedAt: now, approvedById: input.actorId },
      });
      if (approved.count === 0) continue;
      await tx.nasaPlannerPostReview.create({
        data: { postId: groupPost.id, organizationId: groupPost.organizationId, authorId: input.actorId, kind: NasaPlannerReviewKind.APPROVED, body: input.note },
      });
    }
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
