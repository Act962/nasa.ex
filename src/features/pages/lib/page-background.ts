import type { PageLayout } from "../types";

/**
 * Resolve a cor de fundo efetiva de uma page — MESMA precedência usada
 * no PublicPageRenderer (`palette.bg` → `artboard.background` → branco).
 *
 * Fonte única de verdade pra que o renderer (que pinta o artboard) e a
 * rota pública (que pinta o viewport atrás do artboard) nunca divirjam.
 */
export function resolvePageBackground(
  layout: Pick<PageLayout, "artboard"> | null | undefined,
  palette?: Record<string, string> | null,
): string {
  return (
    (palette?.bg as string | undefined) ??
    layout?.artboard?.background ??
    "#ffffff"
  );
}
