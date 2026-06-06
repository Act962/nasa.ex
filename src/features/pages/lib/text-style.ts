/**
 * Sistema de overrides tipográficos pras sections compostas
 * (testimonials, features, pricing, faq, stats, logos).
 *
 * Hoje cada section renderiza textos com `className` hardcoded
 * (ex: `text-sm`, `font-bold`) + cores derivadas dos tokens. Resultado:
 * o user NÃO consegue customizar cor/tamanho/fonte/peso de cada texto.
 *
 * A solução é uma hierarquia em 3 níveis:
 *   1. Default do renderer (mantém estilo atual).
 *   2. Override "global" da section (ex: `quoteStyle` no element) —
 *      vale pra todos os cards da mesma section.
 *   3. Override por card (ex: `card.quoteStyle`) — sobrescreve o
 *      anterior pra aquele card específico.
 *
 * `resolveTextStyle` faz o merge nesse ordem (mais específico vence).
 * Cada section composta consome via `mergedQuoteStyle =
 * resolveTextStyle(card.quoteStyle, element.quoteStyle, DEFAULTS.quote)`.
 *
 * O retorno é um `React.CSSProperties` direto pra spread no `style` do
 * elemento — sem precisar de classes Tailwind dinâmicas (que quebram
 * com purge).
 */
import type { CSSProperties } from "react";

export interface TextStyle {
  /** Hex/rgba — sobrescreve cor derivada de tokens. */
  color?: string;
  /** Tamanho em px — sobrescreve text-{xs/sm/base/lg/xl}. */
  fontSize?: number;
  /** Família — Inter, Roboto, Playfair, etc. */
  fontFamily?: string;
  /** Peso CSS — 100/200/.../900 ou keyword (bold, normal). */
  fontWeight?: string;
  /** Alinhamento. */
  align?: "left" | "center" | "right";
  /** Itálico. */
  italic?: boolean;
  /** Sublinhado. */
  underline?: boolean;
  /** Altura de linha (multiplicador, ex: 1.4). */
  lineHeight?: number;
  /** Espaçamento entre letras em px (pode ser negativo). */
  letterSpacing?: number;
}

/**
 * Combina 3 níveis de TextStyle. `cardLevel` é o mais específico e
 * vence sobre `sectionLevel`, que vence sobre `defaults`. Cada chave
 * `undefined` cai pro nível abaixo.
 */
export function resolveTextStyle(
  cardLevel: TextStyle | undefined,
  sectionLevel: TextStyle | undefined,
  defaults: TextStyle,
): TextStyle {
  return {
    color: cardLevel?.color ?? sectionLevel?.color ?? defaults.color,
    fontSize: cardLevel?.fontSize ?? sectionLevel?.fontSize ?? defaults.fontSize,
    fontFamily:
      cardLevel?.fontFamily ?? sectionLevel?.fontFamily ?? defaults.fontFamily,
    fontWeight:
      cardLevel?.fontWeight ?? sectionLevel?.fontWeight ?? defaults.fontWeight,
    align: cardLevel?.align ?? sectionLevel?.align ?? defaults.align,
    italic: cardLevel?.italic ?? sectionLevel?.italic ?? defaults.italic,
    underline:
      cardLevel?.underline ?? sectionLevel?.underline ?? defaults.underline,
    lineHeight:
      cardLevel?.lineHeight ?? sectionLevel?.lineHeight ?? defaults.lineHeight,
    letterSpacing:
      cardLevel?.letterSpacing ??
      sectionLevel?.letterSpacing ??
      defaults.letterSpacing,
  };
}

/** Converte um `TextStyle` em `style` pronto pra spread em JSX. */
export function textStyleToCSS(style: TextStyle): CSSProperties {
  return {
    color: style.color,
    fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
    fontFamily: style.fontFamily
      ? `${style.fontFamily}, sans-serif`
      : undefined,
    fontWeight: style.fontWeight,
    textAlign: style.align,
    fontStyle: style.italic ? "italic" : undefined,
    textDecoration: style.underline ? "underline" : undefined,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing
      ? `${style.letterSpacing}px`
      : undefined,
  };
}

/**
 * Fontes Google comuns pré-curadas pra dropdown. Pra fontes não
 * listadas, o user pode digitar livre no input.
 */
export const COMMON_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Nunito",
  "Source Sans 3",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "PT Serif",
  "Cormorant Garamond",
  "Oswald",
  "Bebas Neue",
  "Anton",
  "Archivo",
  "Space Grotesk",
  "DM Sans",
] as const;

/** Pesos CSS comuns em ordem semântica. */
export const FONT_WEIGHTS = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi-bold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra-bold" },
  { value: "900", label: "Black" },
] as const;
