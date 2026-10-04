"use client";

import { forwardRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RotateCw, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import {
  useDeletePlannerComment,
  useEditOwnPlannerComment,
  usePlannerPostComments,
  useReplyToPlannerComment,
  useSetPlannerCommentHidden,
} from "../../hooks/use-planner-post-comments";

/** Comentários do post publicado: ler, responder em público ou por DM, ocultar e apagar. */

type CommentItem = ReturnType<typeof usePlannerPostComments>["comments"][number];
type ReplyChannel = "PUBLIC" | "DIRECT_MESSAGE";

const AVATAR_COLOR_CLASSES = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

function avatarColorFor(username: string) {
  const hash = [...username].reduce((total, character) => total + character.charCodeAt(0), 0);
  return AVATAR_COLOR_CLASSES[hash % AVATAR_COLOR_CLASSES.length];
}

function relativeTime(timestamp: string | null) {
  return timestamp ? formatDistanceToNow(new Date(timestamp), { locale: ptBR, addSuffix: true }) : "";
}

function CommentLine({ comment, isReply = false }: { comment: CommentItem; isReply?: boolean }) {
  return (
    <div>
      <p className={cn(isReply ? "text-xs" : "text-sm")}>
        <span className="mr-1.5 font-semibold">{comment.username ?? "conta do Instagram"}</span>
        <span className="text-[11px] text-muted-foreground">{relativeTime(comment.timestamp)}</span>
        {comment.isHidden && <span className="ml-1.5 text-[11px] text-muted-foreground">· oculto</span>}
      </p>
      <p className={cn("whitespace-pre-wrap", isReply ? "text-xs" : "text-sm")}>{comment.text}</p>
    </div>
  );
}

/** Comentário da própria conta: editar (publica o novo, apaga o antigo) e apagar com confirmação. */
function OwnCommentLine({ postId, comment, isReply = false, canManage }: { postId: string; comment: CommentItem; isReply?: boolean; canManage: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [text, setText] = useState(comment.text);
  const editComment = useEditOwnPlannerComment();
  const deleteComment = useDeletePlannerComment();
  const showError = (error: Error) => toast.error(error.message);

  if (!canManage) return <CommentLine comment={comment} isReply={isReply} />;

  if (isEditing) {
    const save = () =>
      editComment.mutate(
        { postId, commentId: comment.id, text },
        {
          onSuccess: () => {
            toast.success("Resposta atualizada.");
            setIsEditing(false);
          },
          onError: showError,
        },
      );
    return (
      <div>
        <p className={cn(isReply ? "text-xs" : "text-sm")}>
          <span className="mr-1.5 font-semibold">{comment.username}</span>
          <span className="text-[11px] text-muted-foreground">{relativeTime(comment.timestamp)}</span>
        </p>
        <Input
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={1000}
          className="mt-1.5 h-8 rounded-full border-primary text-xs"
        />
        <p className="mt-1.5 rounded-xl bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
          O Instagram não edita comentários: a resposta antiga é apagada e a nova é publicada agora, com horário novo.
        </p>
        <div className="mt-1.5 flex justify-end gap-2">
          <button type="button" onClick={() => { setIsEditing(false); setText(comment.text); }} className="rounded-full bg-knob/60 px-3 py-1 text-xs">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!text.trim() || text.trim() === comment.text || editComment.isPending}
            onClick={save}
            className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background disabled:opacity-40"
          >
            {editComment.isPending ? "Salvando…" : "Salvar resposta"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CommentLine comment={comment} isReply={isReply} />
      <div className="mt-0.5 flex gap-3 text-[11px] font-medium text-muted-foreground">
        {isConfirmingDelete ? (
          <>
            <span>Apagar do Instagram?</span>
            <button
              type="button"
              disabled={deleteComment.isPending}
              onClick={() => deleteComment.mutate({ postId, commentId: comment.id }, { onSuccess: () => toast.success("Resposta apagada."), onError: showError })}
              className="text-destructive"
            >
              {deleteComment.isPending ? "Apagando…" : "Sim, apagar"}
            </button>
            <button type="button" onClick={() => setIsConfirmingDelete(false)}>Não</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setIsEditing(true)} className="hover:text-foreground">Editar</button>
            <button type="button" onClick={() => setIsConfirmingDelete(true)} className="text-destructive">Apagar</button>
          </>
        )}
      </div>
    </div>
  );
}

function ReplyBox({ postId, commentId, onDone }: { postId: string; commentId: string; onDone: () => void }) {
  const [channel, setChannel] = useState<ReplyChannel>("PUBLIC");
  const [text, setText] = useState("");
  const replyToComment = useReplyToPlannerComment();

  const send = () =>
    replyToComment.mutate(
      { postId, commentId, text, channel },
      {
        onSuccess: () => {
          toast.success(channel === "PUBLIC" ? "Resposta publicada." : "DM enviada.");
          onDone();
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1.5">
        {(["PUBLIC", "DIRECT_MESSAGE"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setChannel(option)}
            className={cn("rounded-full px-2.5 py-0.5 text-[11px]", channel === option ? "bg-foreground font-semibold text-background" : "bg-knob/60")}
          >
            {option === "PUBLIC" ? "Em público" : "Por DM"}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && text.trim() && send()}
          placeholder={channel === "PUBLIC" ? "Responder em público…" : "Mensagem no direct…"}
          maxLength={1000}
          className="h-9 rounded-full border-primary"
        />
        <button
          type="button"
          disabled={!text.trim() || replyToComment.isPending}
          onClick={send}
          className="rounded-full bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-40"
        >
          {replyToComment.isPending ? "Enviando…" : "Enviar"}
        </button>
      </div>
      {channel === "DIRECT_MESSAGE" && (
        <p className="text-[11px] text-muted-foreground">A Meta permite 1 mensagem privada por comentário, em até 7 dias.</p>
      )}
    </div>
  );
}

function CommentCard({ postId, comment, canReply }: { postId: string; comment: CommentItem; canReply: boolean }) {
  const [isReplying, setIsReplying] = useState(false);
  const setHidden = useSetPlannerCommentHidden();
  const deleteComment = useDeletePlannerComment();
  const username = comment.username ?? "?";
  const showError = (error: Error) => toast.error(error.message);

  return (
    <div className={cn("flex gap-2.5 rounded-2xl bg-card p-2.5", comment.isHidden && "opacity-60")}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white", avatarColorFor(username))}>
        {username.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        {comment.isFromAccount ? <OwnCommentLine postId={postId} comment={comment} canManage={canReply} /> : <CommentLine comment={comment} />}
        {comment.automation && (
          <span className={cn("mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]", comment.automation.status === "SENT" ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive")}>
            <Zap className="size-3" />
            {comment.automation.status === "SENT"
              ? `Automação respondeu${comment.automation.sentDirectMessage ? " · DM enviada" : ""}`
              : "Automação tentou responder e falhou"}
          </span>
        )}
        {comment.replies.length > 0 && (
          <div className="mt-2 space-y-1.5 border-l-2 border-line pl-3">
            {comment.replies.map((reply) =>
              reply.isFromAccount ? (
                <OwnCommentLine key={reply.id} postId={postId} comment={reply} isReply canManage={canReply} />
              ) : (
                <CommentLine key={reply.id} comment={reply} isReply />
              ),
            )}
          </div>
        )}
        {canReply && !comment.isFromAccount && (
          <div className="mt-1.5 flex flex-wrap gap-3.5 text-xs font-medium text-muted-foreground">
            {comment.isHidden ? (
              <>
                <button type="button" onClick={() => setHidden.mutate({ postId, commentId: comment.id, isHidden: false }, { onError: showError })}>Mostrar de novo</button>
                <button
                  type="button"
                  onClick={() => deleteComment.mutate({ postId, commentId: comment.id }, { onSuccess: () => toast.success("Comentário apagado."), onError: showError })}
                  className="text-destructive"
                >
                  Apagar
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setIsReplying((current) => !current)} className={cn(isReplying && "text-foreground")}>Responder</button>
                <button type="button" onClick={() => setHidden.mutate({ postId, commentId: comment.id, isHidden: true }, { onSuccess: () => toast.success("Comentário ocultado."), onError: showError })}>Ocultar</button>
              </>
            )}
          </div>
        )}
        {isReplying && <ReplyBox postId={postId} commentId={comment.id} onDone={() => setIsReplying(false)} />}
      </div>
    </div>
  );
}

export const PostCommentsSection = forwardRef<HTMLElement, { postId: string; canReply: boolean; totalCount: number | null | undefined }>(
  function PostCommentsSection({ postId, canReply, totalCount }, ref) {
    const { comments, isLoading, isFetching, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = usePlannerPostComments(postId);
    const remainingCount = totalCount != null ? Math.max(totalCount - comments.length - comments.reduce((total, comment) => total + comment.replies.length, 0), 0) : null;

    return (
      <section ref={ref} className="rounded-2xl bg-panel p-3">
        <div className="mb-2.5 flex items-center gap-2">
          <p className="text-sm font-semibold">Comentários</p>
          {totalCount != null && <span className="rounded-full bg-foreground px-1.5 text-[11px] text-background">{totalCount}</span>}
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground disabled:opacity-50">
            <RotateCw className={cn("size-3", isFetching && "animate-spin")} /> Atualizar
          </button>
        </div>
        {isLoading ? (
          <OrbitaSpinner className="size-4" />
        ) : error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém comentou ainda.</p>
        ) : (
          <div className="space-y-2">
            {comments.map((comment) => (
              <CommentCard key={comment.id} postId={postId} comment={comment} canReply={canReply} />
            ))}
            {hasNextPage && (
              <button type="button" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()} className="w-full text-center text-xs text-muted-foreground">
                {isFetchingNextPage ? "Carregando…" : remainingCount ? `Ver mais ${remainingCount} comentários` : "Ver mais comentários"}
              </button>
            )}
          </div>
        )}
      </section>
    );
  },
);
