"use client";

import { RefObject, useCallback, useEffect, useState } from "react";

type ScrollMapMetrics = {
  /** `scrollWidth > clientWidth` — controla a renderização do minimapa. */
  hasOverflow: boolean;
  /** `clientWidth / scrollWidth` (0..1) — largura proporcional do viewport. */
  viewportRatio: number;
  /** `scrollLeft / (scrollWidth - clientWidth)` (0..1) — posição atual. */
  scrollRatio: number;
};

type ScrollMapApi = ScrollMapMetrics & {
  /** Rola para uma fração 0..1 do conteúdo. `smooth` por padrão. */
  scrollToRatio: (ratio: number, smooth?: boolean) => void;
};

const INITIAL_METRICS: ScrollMapMetrics = {
  hasOverflow: false,
  viewportRatio: 1,
  scrollRatio: 0,
};

function clamp01(value: number) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Observa um elemento scrollável horizontalmente e expõe métricas reativas
 * (overflow, proporção do viewport e posição) para alimentar um minimapa.
 *
 * Recalcula em: scroll do elemento, resize do elemento (ResizeObserver),
 * mutações no DOM interno (MutationObserver — colunas adicionadas/removidas)
 * e resize da janela.
 */
export function useHorizontalScrollMap<T extends HTMLElement>(
  scrollRef: RefObject<T | null>,
): ScrollMapApi {
  const [metrics, setMetrics] = useState<ScrollMapMetrics>(INITIAL_METRICS);

  const measure = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const { scrollWidth, clientWidth, scrollLeft } = element;
    const maxScroll = scrollWidth - clientWidth;

    setMetrics((previous) => {
      const next: ScrollMapMetrics = {
        hasOverflow: maxScroll > 1,
        viewportRatio: scrollWidth > 0 ? clamp01(clientWidth / scrollWidth) : 1,
        scrollRatio: maxScroll > 0 ? clamp01(scrollLeft / maxScroll) : 0,
      };

      if (
        previous.hasOverflow === next.hasOverflow &&
        previous.viewportRatio === next.viewportRatio &&
        previous.scrollRatio === next.scrollRatio
      ) {
        return previous;
      }
      return next;
    });
  }, [scrollRef]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    measure();

    element.addEventListener("scroll", measure, { passive: true });

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);

    // Colunas entram/saem do DOM (StatusForm, delete, realtime) → remede.
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(element, { childList: true, subtree: true });

    window.addEventListener("resize", measure);

    return () => {
      element.removeEventListener("scroll", measure);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [scrollRef, measure]);

  const scrollToRatio = useCallback(
    (ratio: number, smooth = true) => {
      const element = scrollRef.current;
      if (!element) return;

      const maxScroll = element.scrollWidth - element.clientWidth;
      element.scrollTo({
        left: clamp01(ratio) * maxScroll,
        behavior: smooth ? "smooth" : "auto",
      });
    },
    [scrollRef],
  );

  return { ...metrics, scrollToRatio };
}
