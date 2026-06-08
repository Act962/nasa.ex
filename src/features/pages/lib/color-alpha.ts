/**
 * Helpers de cor com canal alpha no formato hex8 (`#rrggbbaa`).
 *
 * O `<input type="color">` nativo só lida com `#rrggbb` (sem alpha), então
 * separamos a cor em RGB (hex6) + opacidade (0–100) pra editar cada parte
 * isoladamente e recombinar em hex8 ao salvar. CSS renderiza `#rrggbbaa`
 * nativamente, então nada no render precisa converter.
 */

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_RE =
  /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

function toHex2(channel: number): string {
  return Math.max(0, Math.min(255, Math.round(channel)))
    .toString(16)
    .padStart(2, "0");
}

/**
 * Quebra uma cor em `{ hex6, alpha }` (alpha em 0–100). Suporta `#rgb`,
 * `#rrggbb`, `#rrggbbaa` e `rgb()/rgba()`. Para valores não-parseáveis
 * (cores nomeadas, hsl, gradiente), `hex6` é `null` — a UI então mantém só
 * o input de texto, sem slider.
 */
export function parseColorParts(value: string): {
  hex6: string | null;
  alpha: number;
} {
  const input = (value ?? "").trim();

  const hexMatch = input.match(HEX_RE);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((char) => char + char)
        .join("");
    }
    if (hex.length === 8) {
      const alpha = Math.round((parseInt(hex.slice(6, 8), 16) / 255) * 100);
      return { hex6: `#${hex.slice(0, 6).toLowerCase()}`, alpha };
    }
    return { hex6: `#${hex.toLowerCase()}`, alpha: 100 };
  }

  const rgbMatch = input.match(RGB_RE);
  if (rgbMatch) {
    const [, red, green, blue, alphaRaw] = rgbMatch;
    const hex6 = `#${toHex2(Number(red))}${toHex2(Number(green))}${toHex2(
      Number(blue),
    )}`;
    const alpha =
      alphaRaw === undefined ? 100 : Math.round(Number(alphaRaw) * 100);
    return { hex6, alpha: Math.max(0, Math.min(100, alpha)) };
  }

  return { hex6: null, alpha: 100 };
}

/**
 * Recombina `hex6` + opacidade (0–100) em hex8. Retorna `#rrggbb` quando
 * 100% opaco — mantém o formato curto e compatível com cores antigas (sem
 * `ff` redundante no fim).
 */
export function composeHexColor(hex6: string, alphaPercent: number): string {
  const base = hex6.toLowerCase();
  const clamped = Math.max(0, Math.min(100, Math.round(alphaPercent)));
  if (clamped >= 100) return base;
  const alphaHex = toHex2((clamped / 100) * 255);
  return `${base}${alphaHex}`;
}
