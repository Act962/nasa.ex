/**
 * Helper para calcular onde inserir um elemento novo no canvas.
 *
 * Comportamento:
 *
 * 1. **Flow sections** (hero, navbar, footer, features…) — empilha
 *    verticalmente após a última flow section. x sempre 0. Ignora
 *    posição do viewport — sections sempre ficam em fluxo.
 *
 * 2. **Elementos livres** (text, image, button, shape…) — coloca no
 *    centro da viewport visível do canvas (considerando scroll +
 *    zoom). Desconta metade do tamanho do elemento pra que ele
 *    apareça realmente centralizado no que o user está vendo.
 *
 * Lê DOM em tempo real via data-attrs no canvas (sem prop drill).
 */
import type { ElementBase, ElementType } from "../types";
import { isFlowSection } from "./section-flow";

/** Calcula posição de inserção pra um elemento novo. */
export function computeInsertPosition(args: {
  type: ElementType;
  w: number;
  h: number;
  existingElements: ElementBase[];
  zoom: number;
  artboardWidth: number;
}): { x: number; y: number } {
  const { type, w, h, existingElements, zoom, artboardWidth } = args;

  // ── 1. Flow sections — empilha verticalmente ─────────────────
  if (isFlowSection(type)) {
    // Acha o último flow section e empilha logo depois.
    const flowSections = existingElements
      .filter((el) => isFlowSection(el.type as ElementType))
      .sort((a, b) => a.y + a.h - (b.y + b.h));
    const lastBottom =
      flowSections.length > 0
        ? flowSections[flowSections.length - 1].y +
          flowSections[flowSections.length - 1].h
        : 0;
    return { x: 0, y: lastBottom };
  }

  // ── 2. Elementos livres — centro do viewport visível ─────────
  const scrollEl = document.querySelector<HTMLElement>(
    "[data-pages-canvas-scroll]",
  );
  const artboardEl = document.querySelector<HTMLElement>(
    "[data-pages-artboard]",
  );

  if (!scrollEl || !artboardEl) {
    // Fallback razoável: centro horizontal do artboard, topo +
    // ~40px pra não cobrir.
    return {
      x: Math.max(0, Math.round(artboardWidth / 2 - w / 2)),
      y: 40,
    };
  }

  const scrollRect = scrollEl.getBoundingClientRect();
  const artboardRect = artboardEl.getBoundingClientRect();

  // Centro do viewport visível em coordenadas de tela
  const viewportCenterX = scrollRect.left + scrollRect.width / 2;
  const viewportCenterY = scrollRect.top + scrollRect.height / 2;

  // Converte pra coordenadas do artboard (sem zoom). artboardRect já
  // reflete o tamanho escalado, então dividir o offset pelo zoom dá
  // a coord interna.
  const safeZoom = zoom || 1;
  const xInArtboard = (viewportCenterX - artboardRect.left) / safeZoom;
  const yInArtboard = (viewportCenterY - artboardRect.top) / safeZoom;

  // Centraliza o elemento (top-left = center - size/2)
  let x = Math.round(xInArtboard - w / 2);
  let y = Math.round(yInArtboard - h / 2);

  // Clamp dentro do artboard pra não inserir fora
  x = Math.max(0, Math.min(x, artboardWidth - w));
  y = Math.max(0, y);

  return { x, y };
}
