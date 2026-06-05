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
  // Slides visíveis por viewport. Mobile usa metade (mín 1).
  // Default desktop = 1 (clássico carrossel "1 por vez").
  const perViewDesktop = Math.max(
    1,
    Math.min(8, (element.slidesPerView as number) ?? 1),
  );
  const perViewMobile = Math.max(
    1,
    Math.min(perViewDesktop, (element.slidesPerViewMobile as number) ??
      Math.max(1, Math.floor(perViewDesktop / 2))),
  );

  // useState do idx — mas em slide-multi, "idx" é o índice do
  // primeiro slide visível (avança 1 a 1; quando + perView > total,
  // volta pro começo).
  const [idx, setIdx] = useState(0);
  // Tracker responsivo do perView atual — usa window.innerWidth.
  const [perView, setPerView] = useState(perViewDesktop);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      setPerView(window.innerWidth < 640 ? perViewMobile : perViewDesktop);
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, [perViewDesktop, perViewMobile]);

  // Auto-slide — avança 1 slide por tick. Volta pro começo quando
  // o último grupo (idx + perView) ultrapassa total.
  const maxIdx = Math.max(0, slides.length - perView);
  useEffect(() => {
    if (mode !== "slide" || !autoplay || slides.length <= perView) return;
    const handle = setInterval(() => {
      setIdx((prev) => (prev >= maxIdx ? 0 : prev + 1));
    }, Math.max(1000, intervalMs));
    return () => clearInterval(handle);
  }, [mode, autoplay, intervalMs, slides.length, perView, maxIdx]);

  if (slides.length === 0) {
    return (
      <div className="w-full h-full min-h-32 bg-muted/30 border border-dashed rounded flex items-center justify-center text-xs text-muted-foreground">
        Carrossel sem imagens — adicione no painel
      </div>
    );
  }

  // ── MODO STATIC: grid responsivo com N colunas ──
  // perView controla N colunas (1-6). Mobile = perViewMobile cols.
  if (mode === "static") {
    return (
      <div
        className="w-full grid"
        style={{
          gap,
          gridTemplateColumns: `repeat(var(--cols), minmax(0, 1fr))`,
          // Variáveis CSS pra mobile vs desktop. Tailwind sm: pode
          // não compilar aqui (classe dinâmica) — usar style + media
          // via CSS-in-JS inline com data-attrs seria mais complexo.
          // Como fallback responsivo, usamos JS `perView` que já
          // observa resize.
          ["--cols" as keyof React.CSSProperties]: perView,
        } as React.CSSProperties}
      >
        {slides.map((s) => (
          <CarouselImage key={s.id} slide={s} radius={radius} />
        ))}
      </div>
    );
  }

  // ── MODO SLIDE: N por vez com transform animado ──
  const safeIdx = Math.min(idx, maxIdx);
  // Cada slide vira `(100 / perView)%` da largura do viewport
  // visível. translateX move em passos de `100 / perView`%.
  const slideBasisPct = 100 / perView;
  const translatePct = safeIdx * slideBasisPct;
  // Quantidade de "dots" = quantos grupos cabem (slides - perView + 1)
  const totalDots = Math.max(1, slides.length - perView + 1);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ borderRadius: radius }}
    >
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${translatePct}%)`, gap }}
      >
        {slides.map((s) => (
          <div
            key={s.id}
            className="flex-shrink-0"
            style={{
              flexBasis: `calc(${slideBasisPct}% - ${gap * (perView - 1) / perView}px)`,
            }}
          >
            <CarouselImage slide={s} radius={radius} />
          </div>
        ))}
      </div>

      {/* Setas */}
      {showArrows && slides.length > perView && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => setIdx((p) => Math.max(0, p - 1))}
            disabled={safeIdx === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-30 text-white flex items-center justify-center backdrop-blur transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próximo"
            onClick={() => setIdx((p) => Math.min(maxIdx, p + 1))}
            disabled={safeIdx >= maxIdx}
            className="absolute right-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-30 text-white flex items-center justify-center backdrop-blur transition-colors"
          >
            ›
          </button>
        </>
      )}

      {/* Dots */}
      {showDots && slides.length > perView && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {Array.from({ length: totalDots }).map((_, i) => (
            <button
              key={i}
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
