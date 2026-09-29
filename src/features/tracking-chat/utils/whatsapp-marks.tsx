import type { ReactNode } from "react";

// Formatação do WhatsApp: *negrito* e ~riscado~ (itálico com _ ficou de fora: quebra nomes com underline).
const WHATSAPP_MARK_REGEX = /(\*[^*\n]+\*|~[^~\n]+~)/g;

export function renderWhatsappMarks(text: string, keyPrefix = "mark"): ReactNode[] {
  return text.split(WHATSAPP_MARK_REGEX).map((segment, index) => {
    const key = `${keyPrefix}-${index}`;
    if (index % 2 === 0) return segment;
    const inner = segment.slice(1, -1);
    return segment.startsWith("*") ? <strong key={key}>{inner}</strong> : <s key={key}>{inner}</s>;
  });
}
