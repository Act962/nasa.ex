/**
 * Helpers de contraste de cor pro chat — escolhem texto preto ou branco
 * baseado na luminância relativa do fundo (WCAG 2.x). Usado quando o
 * usuário customiza a cor da bolha em Personalização → Aparência do Chat;
 * sem isso, texto preto em fundo escuro (ou vice-versa) fica ilegível
 * quando o usuário alterna entre temas Claro/Escuro.
 */

/** Converte "#RGB" ou "#RRGGBB" em [r,g,b] (0-255). Null se inválido. */
function hexToRgb(hex: string): [number, number, number] | null {
  if (!hex || typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

/** Luminância relativa (WCAG) — 0..1, 0=preto, 1=branco. */
function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Retorna a melhor cor de texto (preto ou branco) pra um fundo dado.
 * Usa luminância 0.5 como threshold — quando cor de fundo é mais clara
 * que isso → texto preto; mais escura → texto branco. É o que dá melhor
 * razão de contraste segundo WCAG (>4.5:1 quase sempre).
 *
 * Devolve cores zinc-900 e zinc-50 pra alinhar com o resto do tema.
 */
export function getContrastingTextColor(bgHex: string | null | undefined): string | null {
  if (!bgHex) return null;
  const rgb = hexToRgb(bgHex);
  if (!rgb) return null;
  const lum = relativeLuminance(rgb);
  return lum > 0.5 ? "#18181b" /* zinc-900 */ : "#fafafa" /* zinc-50 */;
}

/**
 * Versão que devolve uma cor MAIS SUTIL (60% opacity-ish via lighten/darken)
 * pra timestamps e textos secundários. Mantém a mesma direção (preto/branco)
 * mas com menos peso visual.
 */
export function getContrastingMutedTextColor(
  bgHex: string | null | undefined,
): string | null {
  if (!bgHex) return null;
  const rgb = hexToRgb(bgHex);
  if (!rgb) return null;
  const lum = relativeLuminance(rgb);
  // Cinza-escuro/claro com bom contraste mas menos peso
  return lum > 0.5 ? "rgba(24, 24, 27, 0.65)" : "rgba(250, 250, 250, 0.65)";
}
