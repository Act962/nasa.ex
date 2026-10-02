"use client";

import { useState } from "react";
import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSendAstroFeedback } from "@/features/astro-commander/hooks/use-astro-intelligence";

/**
 * Joinha da resposta do ASTRO (spec 0028, RF-15).
 *
 * O 👎 abre um campo de correção, e é ele que vale: "errou" sem dizer o que era
 * o certo não vira regra nenhuma no resumo diário.
 */
export function AstroMessageFeedback({
  sessionId,
  messageId,
  answerExcerpt,
}: {
  sessionId?: string;
  messageId: string;
  answerExcerpt: string;
}) {
  const sendFeedback = useSendAstroFeedback();
  const [sentRating, setSentRating] = useState<"UP" | "DOWN" | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correction, setCorrection] = useState("");

  const send = (rating: "UP" | "DOWN", correctionText?: string) => {
    sendFeedback.mutate(
      {
        rating,
        sessionId,
        messageId,
        answerExcerpt: answerExcerpt.slice(0, 500),
        correction: correctionText?.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSentRating(rating);
          setIsCorrecting(false);
          toast.success(
            rating === "UP" ? "Anotado, obrigado!" : "Anotado. Isso vira sugestão de regra.",
          );
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  if (sentRating) {
    return (
      <p className="flex items-center gap-1 px-1 pt-1 text-[11px] text-foreground/35">
        <Check className="size-3" />
        {sentRating === "UP" ? "Você marcou como útil" : "Você marcou como errado"}
      </p>
    );
  }

  return (
    <div className="px-1 pt-1">
      {isCorrecting ? (
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={correction}
            maxLength={1000}
            placeholder="O certo seria…"
            className="h-7 text-xs"
            onChange={(event) => setCorrection(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") send("DOWN", correction);
              if (event.key === "Escape") setIsCorrecting(false);
            }}
          />
          <Button size="sm" className="h-7" onClick={() => send("DOWN", correction)}>
            Enviar
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/message:opacity-100">
          <button
            type="button"
            aria-label="Resposta útil"
            onClick={() => send("UP")}
            className="grid size-6 place-items-center rounded-md text-foreground/35 transition hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <ThumbsUp className="size-3" />
          </button>
          <button
            type="button"
            aria-label="Resposta errada"
            onClick={() => setIsCorrecting(true)}
            className="grid size-6 place-items-center rounded-md text-foreground/35 transition hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <ThumbsDown className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}
