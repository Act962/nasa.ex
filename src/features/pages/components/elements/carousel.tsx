"use client";

import { useEffect, useState } from "react";
import type { ElementBase } from "../../types";

/**
 * Carousel — galeria de imagens com 2 modos:
 *
 * - **static**: grid responsivo simples (todas visíveis, sem
 *   animação). Útil pra galeria de fotos/portfolio.
 * - **slide**: auto-play horizontal com velocidade configurável.
 *   Mostra 1 slide por vez (com dots/arrows opcionais).
 *
 * Cada slide tem `imageUrl`, `alt`, `link` opcional, e proporção
 * individual (`aspectRatio` em formato "16:9", "1:1", "4:3", "free").
 *
 * Por que client component: precisa de useEffect pro timer do
 * auto-slide e useState pra current index.
 */

export type CarouselSlide = {
  id: string;
  imageUrl: string;
  alt?: string;
  caption?: string;
  link?: string;
  aspectRatio?: string; // ex: "16:9", "1:1", "free"
};

export function CarouselElement({ element }: { element: ElementBase }) {
  const slides = (element.slides as CarouselSlide[] | undefined) ?? [];
  const mode = (element.carouselMode as "static" | "slide") ?? "slide";
  const intervalMs = (element.intervalMs as number) ?? 4000;
  const showDots = (element.showDots as boolean) ?? true;
  const showArrows = (element.showArrows as boolean) ?? true;
  const gap = (element.gap as number) ?? 12;
  const radius = (element.radius as number) ?? 8;
  const autoplay = (element.autoplay as boolean) ?? true;

  const [idx, setIdx] = useState(0);

  // Auto-slide
  useEffect(() => {
    if (mode !== "slide" || !autoplay || slides.length < 2) return;
    const handle = setInterval(() => {
      setIdx((prev) => (prev + 1) % slides.length);
    }, Math.max(1000, intervalMs));
    return () => clearInterval(handle);
  }, [mode, autoplay, intervalMs, slides.length]);

  if (slides.length === 0) {
    return (
      <div className="w-full h-full min-h-32 bg-muted/30 border border-dashed rounded flex items-center justify-center text-xs text-muted-foreground">
        Carrossel sem imagens — adicione no painel
      </div>
    );
  }

  // ── MODO STATIC: grid responsivo ──
  if (mode === "static") {
    return (
      <div
        className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
        style={{ gap }}
      >
        {slides.map((s) => (
          <CarouselImage key={s.id} slide={s} radius={radius} />
        ))}
      </div>
    );
  }

  // ── MODO SLIDE: 1 por vez com transform animado ──
  const safeIdx = Math.min(idx, slides.length - 1);
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ borderRadius: radius }}
    >
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${safeIdx * 100}%)` }}
      >
        {slides.map((s) => (
          <div key={s.id} className="w-full flex-shrink-0">
            <CarouselImage slide={s} radius={0} />
          </div>
        ))}
      </div>

      {/* Setas */}
      {showArrows && slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() =>
              setIdx((p) => (p - 1 + slides.length) % slides.length)
            }
            className="absolute left-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próximo"
            onClick={() => setIdx((p) => (p + 1) % slides.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur transition-colors"
          >
            ›
          </button>
        </>
      )}

      {/* Dots */}
      {showDots && slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Ir para slide ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`size-2 rounded-full transition-all ${
                i === safeIdx ? "w-6 bg-white" : "bg-white/50 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Imagem individual com aspect ratio + link opcional. */
function CarouselImage({
  slide,
  radius,
}: {
  slide: CarouselSlide;
  radius: number;
}) {
  // Resolve aspect-ratio CSS — formato "W:H" ou "free" (sem ratio).
  const aspectStyle = (() => {
    if (!slide.aspectRatio || slide.aspectRatio === "free") return {};
    const [w, h] = slide.aspectRatio.split(":").map((n) => Number(n) || 1);
    return { aspectRatio: `${w} / ${h}` };
  })();

  const content = (
    <div
      className="w-full relative overflow-hidden bg-muted/20"
      style={{ ...aspectStyle, borderRadius: radius }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.imageUrl}
        alt={slide.alt ?? ""}
        className="w-full h-full object-cover"
      />
      {slide.caption && (
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-white text-xs sm:text-sm">
          {slide.caption}
        </div>
      )}
    </div>
  );

  if (slide.link) {
    return (
      <a
        href={slide.link}
        target={slide.link.startsWith("#") ? undefined : "_blank"}
        rel={slide.link.startsWith("#") ? undefined : "noreferrer"}
        className="block"
      >
        {content}
      </a>
    );
  }
  return content;
}
