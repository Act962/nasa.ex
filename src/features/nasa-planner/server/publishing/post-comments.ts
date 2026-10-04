import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { MetaPublishAccountKind } from "@/generated/prisma/enums";
import {
  createIgMediaComment,
  deleteIgComment,
  getIgCommentOwnership,
  listIgMediaComments,
  MetaGraphError,
  replyToIgComment,
  sendIgPrivateReply,
  setIgCommentHidden,
  type IgCommentNode,
} from "@/http/meta/planner-graph";

/** Comentários do post publicado: ler, responder em público ou por DM, ocultar e apagar (tela do post publicado). */

export type PlannerComment = {
  id: string;
  text: string;
  username: string | null;
  timestamp: string | null;
  isHidden: boolean;
  likeCount: number;
  isFromAccount: boolean;
  automation: { status: string; sentDirectMessage: boolean } | null;
  replies: PlannerComment[];
};

async function loadPostAccess(postId: string) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({
    where: { id: postId },
    select: { organizationId: true, externalIgPostId: true, targetIgAccountId: true },
  });
  if (!post.externalIgPostId) throw new ORPCError("BAD_REQUEST", { message: "O post ainda não está no Instagram." });
  const account = await prisma.metaPublishAccount.findFirst({
    where: {
      organizationId: post.organizationId,
      kind: MetaPublishAccountKind.IG_BUSINESS,
      ...(post.targetIgAccountId && { igUserId: post.targetIgAccountId }),
    },
    select: { igUserId: true, pageId: true, accessTokenEnc: true },
  });
  if (!account) throw new ORPCError("BAD_REQUEST", { message: "Conta do Instagram não encontrada. Reconecte a Meta nos Satélites." });
  return { mediaId: post.externalIgPostId, igUserId: account.igUserId, pageId: account.pageId, accessToken: decryptSecret(account.accessTokenEnc) };
}

function toGraphError(error: unknown): never {
  if (error instanceof MetaGraphError) throw new ORPCError("BAD_REQUEST", { message: `A Meta recusou: ${error.message}` });
  throw error;
}

export async function listPlannerPostComments(postId: string, after?: string) {
  const access = await loadPostAccess(postId);
  const page = await listIgMediaComments(access.accessToken, access.mediaId, after).catch(toGraphError);
  const nodes = page.data ?? [];

  const commentIds = nodes.map((node) => node.id);
  const inboundEvents = commentIds.length
    ? await prisma.socialInboundEvent.findMany({
        where: { provider: "INSTAGRAM", externalEventId: { in: commentIds } },
        select: { externalEventId: true, runs: { select: { status: true, stepRuns: { select: { kind: true, status: true } } }, take: 1 } },
      })
    : [];
  const automationByCommentId = new Map(
    inboundEvents
      .filter((inboundEvent) => inboundEvent.runs.length > 0)
      .map((inboundEvent) => {
        const [run] = inboundEvent.runs;
        const sentDirectMessage = run.stepRuns.some((stepRun) => stepRun.kind === "SEND_DIRECT_MESSAGE" && stepRun.status === "SENT");
        return [inboundEvent.externalEventId, { status: run.status, sentDirectMessage }] as const;
      }),
  );

  const toComment = (node: IgCommentNode): PlannerComment => ({
    id: node.id,
    text: node.text ?? "",
    username: node.username ?? node.from?.username ?? null,
    timestamp: node.timestamp ?? null,
    isHidden: Boolean(node.hidden),
    likeCount: node.like_count ?? 0,
    isFromAccount: Boolean(access.igUserId && node.from?.id === access.igUserId),
    automation: automationByCommentId.get(node.id) ?? null,
    replies: (node.replies?.data ?? []).map(toComment),
  });

  return {
    comments: nodes.map(toComment),
    nextCursor: page.paging?.next ? (page.paging.cursors?.after ?? null) : null,
  };
}

/** Toda ação confere na Meta que o comentário é deste post: o id vem do navegador. */
async function assertCommentBelongsToPost(access: Awaited<ReturnType<typeof loadPostAccess>>, commentId: string) {
  const ownership = await getIgCommentOwnership(access.accessToken, commentId).catch(toGraphError);
  if (ownership.mediaId !== access.mediaId) throw new ORPCError("FORBIDDEN", { message: "Este comentário não é deste post." });
  return ownership;
}

export async function replyToPlannerComment(input: { postId: string; commentId: string; text: string; channel: "PUBLIC" | "DIRECT_MESSAGE" }) {
  const access = await loadPostAccess(input.postId);
  await assertCommentBelongsToPost(access, input.commentId);
  if (input.channel === "DIRECT_MESSAGE") {
    await sendIgPrivateReply(access.accessToken, access.pageId, input.commentId, input.text).catch(toGraphError);
    return { ok: true as const };
  }
  await replyToIgComment(access.accessToken, input.commentId, input.text).catch(toGraphError);
  return { ok: true as const };
}

export async function setPlannerCommentHidden(input: { postId: string; commentId: string; isHidden: boolean }) {
  const access = await loadPostAccess(input.postId);
  await assertCommentBelongsToPost(access, input.commentId);
  await setIgCommentHidden(access.accessToken, input.commentId, input.isHidden).catch(toGraphError);
  return { ok: true as const };
}

export async function deletePlannerComment(input: { postId: string; commentId: string }) {
  const access = await loadPostAccess(input.postId);
  await assertCommentBelongsToPost(access, input.commentId);
  await deleteIgComment(access.accessToken, input.commentId).catch(toGraphError);
  return { ok: true as const };
}

/**
 * O Instagram não edita comentário: publica o texto novo no mesmo lugar (resposta ao mesmo pai, ou no post)
 * e só então apaga o antigo — se publicar falhar, o antigo fica.
 */
export async function editPlannerOwnComment(input: { postId: string; commentId: string; text: string }) {
  const access = await loadPostAccess(input.postId);
  const ownership = await assertCommentBelongsToPost(access, input.commentId);
  if (!access.igUserId || ownership.authorId !== access.igUserId) {
    throw new ORPCError("FORBIDDEN", { message: "Só dá para editar comentários da própria conta." });
  }
  const created = ownership.parentId
    ? await replyToIgComment(access.accessToken, ownership.parentId, input.text).catch(toGraphError)
    : await createIgMediaComment(access.accessToken, access.mediaId, input.text).catch(toGraphError);
  await deleteIgComment(access.accessToken, input.commentId).catch(toGraphError);
  return { commentId: created.id };
}
