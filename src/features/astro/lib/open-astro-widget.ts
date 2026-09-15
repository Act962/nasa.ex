/**
 * Abre o painel de chat do Astro de qualquer lugar do cliente (spec 0015).
 *
 * É um evento de DOM, e não uma chamada ao store, para que código fora da
 * árvore React (scripts, integrações embutidas) também consiga abrir o painel.
 * O `AstroWidgetPanel` escuta e envia o `prompt`, se vier.
 */

export const ASTRO_OPEN_EVENT = "astro:open";

export interface AstroOpenEventDetail {
  prompt?: string;
}

export function openAstroWidget(prompt?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AstroOpenEventDetail>(ASTRO_OPEN_EVENT, { detail: { prompt } }),
  );
}
