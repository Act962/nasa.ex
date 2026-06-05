/**
 * Helper pra detectar elementos que devem renderizar em FLUXO VERTICAL
 * (full-width, altura intrínseca, responsivo) em vez do modo absoluto
 * tradicional do canvas.
 *
 * Sections completas (hero, features, pricing, etc), navbar, footer e
 * marquee precisam comportar-se como blocos de landing real — empilhar
 * verticalmente e ocupar 100% do viewport. Elementos "átomo" (text,
 * image, button, shape, etc) continuam com posicionamento livre.
 */
import type { ElementType } from "../types";

/**
 * Tipos que renderizam em fluxo vertical full-width.
 * Quando uma page tem qualquer desses elementos, o LayerSurface usa
 * modo "flow" — empilha eles verticalmente em ordem (sort por y).
 */
const FLOW_TYPES: ElementType[] = [
  "section-hero",
  "section-features",
  "section-pricing",
  "section-cta",
  "section-stats",
  "section-testimonials",
  "section-faq",
  "section-logo-cloud",
  "section-navbar",
  "section-footer",
  "marquee",
];

export function isFlowSection(type: ElementType): boolean {
  return FLOW_TYPES.includes(type);
}

/**
 * Decide o modo de renderização da page baseado nos elementos.
 * Se houver QUALQUER section de fluxo, a page inteira vira "landing
 * mode" (todos os elementos empilham verticalmente, sem posicionamento
 * absoluto). Senão, mantém o modo "canvas" original.
 *
 * Isso permite que pages antigas (criadas com átomos posicionados
 * manualmente) continuem funcionando, enquanto pages novas baseadas
 * em templates virem landings responsivas.
 */
export function pageRenderMode(
  elements: Array<{ type: string }>,
): "landing" | "canvas" {
  const hasFlow = elements.some((el) =>
    isFlowSection(el.type as ElementType),
  );
  return hasFlow ? "landing" : "canvas";
}
