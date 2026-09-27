"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { formatDateTime } from "@/features/astro-commander/lib/labels";
import { useAstroFeedback } from "@/features/astro-commander/hooks/use-astro-intelligence";

/**
 * Aprender com o uso (spec 0028, RF-15/RF-16): o 👍/👎 das respostas e as
 * correções que viram sugestão de regra no resumo diário.
 */
export function FeedbackSection() {
  const { feedbacks, isLoading } = useAstroFeedback();

  return (
    <section className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <ThumbsUp className="size-4 text-muted-foreground" />
          Aprender com o uso
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          O que a equipe marcou como certo ou errado nas respostas do ASTRO. Uma vez por dia, as
          correções viram sugestões de regra aqui em cima — nenhuma vale sem alguém ativar.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : feedbacks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma avaliação ainda. No widget do ASTRO, o joinha embaixo de cada resposta é o que
          alimenta esta lista.
        </div>
      ) : (
        <div className="space-y-2">
          {feedbacks.map((feedback) => (
            <div key={feedback.id} className="flex items-start gap-3 rounded-xl border p-3">
              {feedback.rating === "UP" ? (
                <ThumbsUp className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              ) : (
                <ThumbsDown className="mt-0.5 size-4 shrink-0 text-rose-500" />
              )}
              <div className="min-w-0 flex-1">
                {feedback.correction && <p className="text-sm">{feedback.correction}</p>}
                {feedback.answerExcerpt && (
                  <p className="truncate text-xs text-muted-foreground">
                    Resposta: {feedback.answerExcerpt}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {feedback.user?.name ?? "Alguém"} · {formatDateTime(feedback.createdAt)}
                  {feedback.processedAt ? " · já virou sugestão" : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
