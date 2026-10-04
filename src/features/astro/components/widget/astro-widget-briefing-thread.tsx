"use client";

import { useEffect, useState, type ReactNode } from "react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { AstroMark } from "@/features/astro/components/astro-mark";

/** As duas mensagens de abertura do Astro (spec 0056), com "digitando" antes de cada uma, para parecer ao vivo. */

type BriefingPhase = "typing-summary" | "summary" | "typing-follow-up" | "follow-up";

const TYPING_DURATION_MS = 2000;
const PAUSE_BETWEEN_MESSAGES_MS = 900;

function AstroBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-start gap-2.5 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-info p-px">
        <AstroMark />
      </span>
      <div className="min-w-0 rounded-[18px] rounded-tl-md bg-foreground/[0.06] px-3.5 py-2.5 text-[0.95rem] leading-snug text-foreground">
        {children}
      </div>
    </div>
  );
}

function AstroTyping() {
  return (
    <div role="status" className="flex items-center gap-2 pl-1 text-xs text-foreground/45 animate-in fade-in-0 duration-200">
      <OrbitaSpinner className="size-4 text-info" />
      Astro está digitando…
    </div>
  );
}

export function AstroWidgetBriefingThread({
  summaryMessage,
  followUpMessage,
}: {
  /** `null` enquanto os números carregam: o "digitando" segue na tela. */
  summaryMessage: string | null;
  /** Sem ela, a conversa para na primeira mensagem. */
  followUpMessage?: string;
}) {
  const [phase, setPhase] = useState<BriefingPhase>("typing-summary");

  useEffect(() => {
    if (!summaryMessage) return;
    const timers = [setTimeout(() => setPhase("summary"), TYPING_DURATION_MS)];
    if (followUpMessage) {
      timers.push(
        setTimeout(() => setPhase("typing-follow-up"), TYPING_DURATION_MS + PAUSE_BETWEEN_MESSAGES_MS),
        setTimeout(() => setPhase("follow-up"), 2 * TYPING_DURATION_MS + PAUSE_BETWEEN_MESSAGES_MS),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [summaryMessage, followUpMessage]);

  const isSummaryVisible = phase !== "typing-summary";

  return (
    <div aria-live="polite" className="flex w-full max-w-sm flex-col gap-2.5">
      {isSummaryVisible && summaryMessage && <AstroBubble>{summaryMessage}</AstroBubble>}
      {phase === "follow-up" && followUpMessage && <AstroBubble>{followUpMessage}</AstroBubble>}
      {(phase === "typing-summary" || phase === "typing-follow-up") && <AstroTyping />}
    </div>
  );
}
