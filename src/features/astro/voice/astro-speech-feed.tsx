"use client";

import { XIcon } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
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
  urgent: "bg-destructive",
  important: "bg-warning",
  info: "bg-info",
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
  const hideBalloons = useAstroFeedStore((state) => state.hide);
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
    <div key={bubbleKey} className="group/balloon pointer-events-auto relative animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95 duration-300 motion-reduce:animate-none">
    <button
      type="button"
      onClick={handleClick}
      aria-live="polite"
      className={cn(POINTER_RADIUS[pointsTo], "max-w-[min(280px,calc(100vw-2.5rem))] bg-white px-3.5 py-2.5 pr-7 text-left text-foreground shadow-[0_10px_26px_-8px_rgba(0,0,0,0.5)] transition-colors hover:bg-panel")}
    >
      {voiceHint ? (
        <span className="text-[0.9rem] leading-snug">{voiceHint}</span>
      ) : current ? (
        <span className="flex items-start gap-2">
          {current.kind === "activity" ? (
            <OrbitaSpinner className="mt-0.5 size-3.5 shrink-0 text-info" />
          ) : (
            <span
              className={cn(
                "mt-[0.4rem] size-2 shrink-0 rounded-full",
                PRIORITY_ACCENT[current.priority],
                current.priority === "urgent" && "animate-pulse",
              )}
            />
          )}
          {/* Só o título: o texto completo está no Início do widget, ao clicar. */}
          <span className="min-w-0 text-[0.9rem] font-semibold leading-snug">{current.headline}</span>
        </span>
      ) : null}
    </button>
    {current && !voiceHint && (
      <button
        type="button"
        onClick={hideBalloons}
        aria-label="Esconder avisos do Astro nesta página"
        title="Esconder"
        className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full text-muted-foreground/70 opacity-60 transition-opacity hover:bg-panel hover:text-foreground group-hover/balloon:opacity-100 focus-visible:opacity-100"
      >
        <XIcon className="size-3" />
      </button>
    )}
    </div>
  );
}
