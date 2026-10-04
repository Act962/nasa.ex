"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { Textarea } from "@/components/ui/textarea";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import {
  useApprovePlannerPost,
  useCommentOnPlannerPost,
  usePlannerReviews,
  useRequestPlannerPostChanges,
  useSubmitPlannerPostForApproval,
} from "../../hooks/use-planner-approval";
import { POST_STATUS_META } from "./planner-v2-utils";
import type { usePlannerPost } from "../../hooks/use-planner-calendar";

/** Passo 3 do criador (spec 0058, RF-3/RF-4): checklist da marca, conversa e decisão do revisor. */

type ComposerPost = NonNullable<ReturnType<typeof usePlannerPost>["post"]>;
type ComposerPermissions = NonNullable<ReturnType<typeof usePlannerPost>["permissions"]>;

const REVIEW_KIND_LABELS: Record<string, string> = {
  SUBMITTED: "enviou para aprovação",
  COMMENT: "comentou",
  CHANGES_REQUESTED: "pediu ajustes",
  APPROVED: "aprovou",
  REOPENED: "reabriu",
};

const CHECK_ICONS = {
  ok: <CheckCircle2 className="size-4 shrink-0 text-success" />,
  warn: <AlertTriangle className="size-4 shrink-0 text-warning" />,
  manual: <Circle className="size-4 shrink-0 text-muted-foreground" />,
};

export function ReviewPanel({ post, permissions, onApproved }: { post: ComposerPost; permissions: ComposerPermissions; onApproved: () => void }) {
  const [message, setMessage] = useState("");
  const { reviews, checklist, isLoading } = usePlannerReviews(post.id);
  const submitForApproval = useSubmitPlannerPostForApproval();
  const requestChanges = useRequestPlannerPostChanges();
  const approvePost = useApprovePlannerPost();
  const commentOnPost = useCommentOnPlannerPost();
  const isAwaitingReview = post.status === "PENDING_APPROVAL";
  const canSubmit = post.status === "IDEA" || post.status === "DRAFT" || post.status === "CHANGES_REQUESTED";
  const showError = (error: Error) => toast.error(error.message || "Não deu certo. Tente de novo.");

  const sendComment = () => {
    if (!message.trim()) return;
    commentOnPost.mutate({ postId: post.id, body: message.trim() }, { onSuccess: () => setMessage(""), onError: showError });
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full bg-panel px-2.5 py-1 text-xs font-semibold", POST_STATUS_META[post.status].textClassName)}>
          {POST_STATUS_META[post.status].label}
        </span>
        {post.sourceActorLabel && <span className="text-xs text-muted-foreground">Enviado por {post.sourceActorLabel}</span>}
      </div>

      <section className="rounded-2xl bg-panel p-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Checklist da marca</p>
        {isLoading ? (
          <OrbitaSpinner className="size-4" />
        ) : (
          <ul className="space-y-1.5 text-sm">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                {CHECK_ICONS[item.status]}
                <span>
                  {item.label}
                  {item.detail && <span className="block text-xs text-muted-foreground">{item.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        {reviews.map((review) => (
          <div key={review.id} className="rounded-2xl bg-panel px-3 py-2 text-sm">
            <p className="text-[11px] text-muted-foreground">
              {review.author?.name ?? "Alguém"} {REVIEW_KIND_LABELS[review.kind] ?? ""} · {format(new Date(review.createdAt), "d MMM, HH:mm", { locale: ptBR })}
            </p>
            {review.body && <p className="whitespace-pre-wrap">{review.body}</p>}
          </div>
        ))}
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={isAwaitingReview && permissions.canApprove ? "Escreva o que precisa mudar ou um comentário…" : "Escreva um comentário…"}
          className="min-h-20 rounded-2xl"
        />
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={sendComment} disabled={!message.trim() || commentOnPost.isPending} className="rounded-full bg-panel px-4 py-2 text-sm disabled:opacity-40">
          Comentar
        </button>
        {canSubmit && permissions.canEdit && (
          <button
            type="button"
            data-guide={GUIDE_ANCHORS.plannerComposerSubmitApproval.id}
            disabled={submitForApproval.isPending}
            onClick={() => submitForApproval.mutate({ postId: post.id, note: message.trim() || undefined }, { onSuccess: () => { setMessage(""); toast.success("Enviado para aprovação."); }, onError: showError })}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-40"
          >
            Enviar para aprovação
          </button>
        )}
        {permissions.canApprove && (isAwaitingReview || canSubmit) && (
          <>
            <button
              type="button"
              data-guide={GUIDE_ANCHORS.plannerReviewRequestChanges.id}
              disabled={message.trim().length < 3 || requestChanges.isPending}
              onClick={() => requestChanges.mutate({ postId: post.id, body: message.trim() }, { onSuccess: () => { setMessage(""); toast.success("Ajustes pedidos."); }, onError: showError })}
              className="rounded-full bg-destructive/15 px-4 py-2 text-sm font-semibold text-destructive disabled:opacity-40"
            >
              Pedir ajustes
            </button>
            <button
              type="button"
              data-guide={GUIDE_ANCHORS.plannerReviewApprove.id}
              disabled={approvePost.isPending}
              onClick={() => approvePost.mutate({ postId: post.id, note: message.trim() || undefined }, { onSuccess: () => { setMessage(""); toast.success("Conteúdo aprovado."); emitTourResult({ kind: GUIDE_RESULT_KINDS.plannerPostApproved }); onApproved(); }, onError: showError })}
              className="rounded-full bg-success px-4 py-2 text-sm font-bold text-background disabled:opacity-40"
            >
              Aprovar
            </button>
          </>
        )}
        {(post.status === "APPROVED" || post.status === "SCHEDULED") && (
          <button type="button" onClick={onApproved} className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
            Ir para a programação
          </button>
        )}
      </div>
    </div>
  );
}
