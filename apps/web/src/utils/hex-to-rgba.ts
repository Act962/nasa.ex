/**
 * Converte uma cor hex (`#rgb` ou `#rrggbb`) em `rgba(r,g,b,a)` com alpha
 * variável de 0..1. Retorna a string original se já estiver em formato
 * `rgb`/`rgba`/`hsl` (não tenta parsear esses) ou `null` quando o input é
 * `null`/`undefined`.
 *
 * Útil pra aplicar transparência configurável (slider 0-100) em cima de
 * uma cor de fundo hex que o usuário escolheu via picker.
 */
export function hexToRgba(
  color: string | null | undefined,
  opacityPercent: number,
): string | null {
  if (!color) return null;
  const opacity = Math.max(0, Math.min(100, opacityPercent)) / 100;

  // Se já é rgb/rgba/hsl, deixa passar (browser interpreta — não dá pra
  // injetar alpha sem parser completo).
  if (
    color.startsWith("rgb") ||
    color.startsWith("hsl") ||
    !color.startsWith("#")
  ) {
    return color;
  }

  let hex = color.slice(1);
  // Expande shorthand #rgb → #rrggbb.
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hex.length !== 6) return color;

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return color;

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
