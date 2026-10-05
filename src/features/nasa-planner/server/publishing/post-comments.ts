import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { ContentPublishError, type PublishedComment } from "@/modules/social/ports/content-publisher";
import { loadInstagramPublisherForPost } from "./instagram-channels";

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
  const access = await loadInstagramPublisherForPost(post);
  if (!access) throw new ORPCError("BAD_REQUEST", { message: "Conta do Instagram não encontrada. Conecte a conta nos Satélites." });
  return { mediaId: post.externalIgPostId, igUserId: access.externalAccountId, publisher: access.publisher };
}

type CommentErrorSubject = "comment" | "post";

const EXPIRED_TOKEN_CODE = 190;
const INVALID_PARAMETER_CODE = 100;
const MISSING_OBJECT_SUBCODE = 33;
const MISSING_CAPABILITY_CODE = 3;
const MISSING_PERMISSION_CODE = 10;
const ACTION_BLOCKED_CODE = 368;
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

/** "Object with ID ... does not exist": o que foi apagado direto no Instagram. Nem toda resposta traz o subcódigo. */
function isMissingObjectError(error: unknown): boolean {
  if (!(error instanceof ContentPublishError) || error.code !== INVALID_PARAMETER_CODE) return false;
  return error.subcode === MISSING_OBJECT_SUBCODE || /does not exist/i.test(error.message);
}

const MISSING_OBJECT_MESSAGE: Record<CommentErrorSubject, string> = {
  comment: "Este comentário não existe mais no Instagram: foi apagado por lá. Atualizamos a lista.",
  post: "Este post não está mais no Instagram: foi apagado ou arquivado por lá.",
};

/** Traduz o erro da Graph API para o que a pessoa pode fazer; o texto cru da Meta só aparece quando não reconhecemos o caso. */
function toCommentActionError(subject: CommentErrorSubject) {
  return (error: unknown): never => {
    if (!(error instanceof ContentPublishError)) throw error;
    if (isMissingObjectError(error)) throw new ORPCError("NOT_FOUND", { message: MISSING_OBJECT_MESSAGE[subject] });
    if (error.code === EXPIRED_TOKEN_CODE) {
      throw new ORPCError("BAD_REQUEST", { message: "A conexão desta conta do Instagram expirou ou foi revogada. Reconecte em Satélites › Instagram." });
    }
    if (error.code !== null && RATE_LIMIT_CODES.has(error.code)) {
      throw new ORPCError("TOO_MANY_REQUESTS", { message: "O Instagram pediu uma pausa por excesso de ações. Espere alguns minutos e tente de novo." });
    }
    if (error.code === ACTION_BLOCKED_CODE) {
      throw new ORPCError("BAD_REQUEST", { message: "O Instagram bloqueou esta ação por enquanto nesta conta. Tente mais tarde." });
    }
    const isPermissionError =
      error.code === MISSING_CAPABILITY_CODE || error.code === MISSING_PERMISSION_CODE || (error.code !== null && error.code >= 200 && error.code < 300);
    if (isPermissionError) {
      throw new ORPCError("FORBIDDEN", {
        message: "O token desta conta não tem permissão para esta ação com comentários. Libere a permissão no app da Meta e troque a credencial em Satélites › Instagram.",
      });
    }
    if (error.isTransient) {
      throw new ORPCError("SERVICE_UNAVAILABLE", { message: "O Instagram ficou instável agora. Tente de novo em instantes." });
    }
    throw new ORPCError("BAD_REQUEST", { message: `O Instagram recusou a ação: ${error.message}` });
  };
}

const toCommentError = toCommentActionError("comment");
const toPostError = toCommentActionError("post");

export async function listPlannerPostComments(postId: string, after?: string) {
  const access = await loadPostAccess(postId);
  const page = await access.publisher.listMediaComments(access.mediaId, after).catch(toPostError);
  const nodes = page.comments;

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

  const toComment = (node: PublishedComment): PlannerComment => ({
    id: node.id,
    text: node.text,
    username: node.username,
    timestamp: node.timestamp,
    isHidden: node.isHidden,
    likeCount: node.likeCount,
    isFromAccount: node.authorId === access.igUserId,
    automation: automationByCommentId.get(node.id) ?? null,
    replies: node.replies.map(toComment),
  });

  return {
    comments: nodes.map(toComment),
    nextCursor: page.nextCursor,
  };
}

/** Toda ação confere na Meta que o comentário é deste post: o id vem do navegador. */
async function assertCommentBelongsToPost(access: Awaited<ReturnType<typeof loadPostAccess>>, commentId: string) {
  const ownership = await access.publisher.getCommentOwnership(commentId).catch(toCommentError);
  if (ownership.mediaId !== access.mediaId) throw new ORPCError("FORBIDDEN", { message: "Este comentário não é deste post." });
  return ownership;
}

export async function replyToPlannerComment(input: { postId: string; commentId: string; text: string; channel: "PUBLIC" | "DIRECT_MESSAGE" }) {
  const access = await loadPostAccess(input.postId);
  await assertCommentBelongsToPost(access, input.commentId);
  if (input.channel === "DIRECT_MESSAGE") {
    await access.publisher.sendPrivateReply(input.commentId, input.text).catch(toCommentError);
    return { ok: true as const };
  }
  await access.publisher.replyToComment(input.commentId, input.text).catch(toCommentError);
  return { ok: true as const };
}

export async function setPlannerCommentHidden(input: { postId: string; commentId: string; isHidden: boolean }) {
  const access = await loadPostAccess(input.postId);
  await assertCommentBelongsToPost(access, input.commentId);
  await access.publisher.setCommentHidden(input.commentId, input.isHidden).catch(toCommentError);
  return { ok: true as const };
}

export async function deletePlannerComment(input: { postId: string; commentId: string }) {
  const access = await loadPostAccess(input.postId);
  // Apagar o que já foi apagado no Instagram é sucesso: o resultado pedido já vale.
  const isAlreadyDeleted = await access.publisher.getCommentOwnership(input.commentId).then(
    (ownership) => {
      if (ownership.mediaId !== access.mediaId) throw new ORPCError("FORBIDDEN", { message: "Este comentário não é deste post." });
      return false;
    },
    (error: unknown) => (isMissingObjectError(error) ? true : toCommentError(error)),
  );
  if (isAlreadyDeleted) return { ok: true as const };
  await access.publisher.deleteComment(input.commentId).catch((error: unknown) => (isMissingObjectError(error) ? undefined : toCommentError(error)));
  return { ok: true as const };
}

/**
 * O Instagram não edita comentário: publica o texto novo no mesmo lugar (resposta ao mesmo pai, ou no post)
 * e só então apaga o antigo — se publicar falhar, o antigo fica.
 */
export async function editPlannerOwnComment(input: { postId: string; commentId: string; text: string }) {
  const access = await loadPostAccess(input.postId);
  const ownership = await assertCommentBelongsToPost(access, input.commentId);
  if (ownership.authorId !== access.igUserId) {
    throw new ORPCError("FORBIDDEN", { message: "Só dá para editar comentários da própria conta." });
  }
  const created = ownership.parentId
    ? await access.publisher.replyToComment(ownership.parentId, input.text).catch(toCommentError)
    : await access.publisher.createMediaComment(access.mediaId, input.text).catch(toPostError);
  await access.publisher.deleteComment(input.commentId).catch(toCommentError);
  return { commentId: created.id };
}
