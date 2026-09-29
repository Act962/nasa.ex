"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAstroFeedStore, type AstroFeedItem } from "./use-astro-feed-store";
import { useAstroWidgetStore } from "./use-astro-widget-store";

/**
 * Balão de fala do ASTRO acima do ícone (spec 0029, RF-10), no mesmo desenho
 * do ASTRO do site orbitatec.com.br (`@nerp/astro-widget`, `.o-astro-balao`):
 * branco, texto escuro, canto de baixo à direita reto apontando para o ícone.
 *
 * Um balão por vez — o mais recente. Pilha de avisos em cima da tela do
 * usuário vira parede de texto; o resto está na aba Início do widget.
 */

const PRIORITY_ACCENT: Record<AstroFeedItem["priority"], string> = {
  urgent: "bg-rose-500",
  important: "bg-amber-500",
  info: "bg-sky-500",
};

/** Canto do balão que aponta para o orb — o único sem arredondar. */
export type BubblePointer = "bottom-right" | "bottom-left" | "top-right" | "top-left";

const POINTER_RADIUS: Record<BubblePointer, string> = {
  "bottom-right": "rounded-[16px_16px_4px_16px]",
  "bottom-left": "rounded-[16px_16px_16px_4px]",
  "top-right": "rounded-[16px_4px_16px_16px]",
  "top-left": "rounded-[4px_16px_16px_16px]",
};

export function AstroSpeechFeed({
  /** Mensagem da voz (escuta, captura) — tem precedência sobre os avisos. */
  voiceHint,
  pointsTo = "bottom-right",
}: {
  voiceHint: string | null;
  /** Lado do orb em relação ao balão; muda quando o usuário arrasta o ASTRO. */
  pointsTo?: BubblePointer;
}) {
  const items = useAstroFeedStore((state) => state.items);
  const removeItem = useAstroFeedStore((state) => state.remove);
  const openWidget = useAstroWidgetStore((state) => state.open);
  const setView = useAstroWidgetStore((state) => state.setView);

  const current = items[items.length - 1];
  if (!current && !voiceHint) return null;

  function handleClick() {
    if (!current) {
      openWidget();
      return;
    }
    removeItem(current.id);
    setView(current.openView ?? "home");
    openWidget();
  }

  // `key` troca a cada aviso, então a animação de entrada roda de novo.
  const bubbleKey = voiceHint ? `voice-${voiceHint}` : current?.id;

  return (
    <button
      key={bubbleKey}
      type="button"
      onClick={handleClick}
      aria-live="polite"
      className={cn(POINTER_RADIUS[pointsTo], "pointer-events-auto animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95 duration-300 motion-reduce:animate-none max-w-[min(280px,calc(100vw-2.5rem))] bg-white px-3.5 py-2.5 text-left text-[#0b1220] shadow-[0_10px_26px_-8px_rgba(0,0,0,0.5)] transition-colors hover:bg-[#f5f8ff]")}
    >
      {voiceHint ? (
        <span className="text-[0.9rem] leading-snug">{voiceHint}</span>
      ) : current ? (
        <span className="flex items-start gap-2">
          {current.kind === "activity" ? (
            <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-violet-600" />
          ) : (
            <span
              className={cn(
                "mt-[0.4rem] size-2 shrink-0 rounded-full",
                PRIORITY_ACCENT[current.priority],
                current.priority === "urgent" && "animate-pulse",
              )}
            />
          )}
          <span className="min-w-0">
            <span className="block text-[0.9rem] font-semibold leading-snug">
              {current.headline}
            </span>
            {current.detail && (
              <span className="mt-0.5 line-clamp-2 block text-[0.8rem] leading-snug text-[#475467]">
                {current.detail}
              </span>
            )}
            {items.length > 1 && (
              <span className="mt-1 block text-[0.72rem] text-[#667085]">
                +{items.length - 1} {items.length - 1 === 1 ? "aviso" : "avisos"} no Início
              </span>
            )}
          </span>
        </span>
      ) : null}
    </button>
  );
}
