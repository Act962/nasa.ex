/**
 * Destaque dentro de títulos: o trecho entre *asteriscos* sai na cor de destaque (e em itálico,
 * se ligado). Cor e itálico vêm do próprio bloco (`highlightColor`, `highlightItalic`).
 */
import type { ReactNode } from "react";
import type { ElementBase } from "../../../types";

const HIGHLIGHT_SPLIT_PATTERN = /\*([^*\n]+)\*/;

export function renderHighlightedText(text: string, element: ElementBase, fallbackColor: string): ReactNode {
  if (!text.includes("*")) return text;
  const segments = text.split(HIGHLIGHT_SPLIT_PATTERN);
  if (segments.length === 1) return text;

  const highlightColor = (element.highlightColor as string | undefined) || fallbackColor;
  const isItalic = (element.highlightItalic as boolean | undefined) ?? true;

  // split com grupo de captura: índices ímpares são os trechos entre asteriscos.
  return segments.map((segment, segmentIndex) =>
    segmentIndex % 2 === 1 ? (
      <em key={segmentIndex} style={{ color: highlightColor, fontStyle: isItalic ? "italic" : "normal" }}>
        {segment}
      </em>
    ) : (
      segment
    ),
  );
}
