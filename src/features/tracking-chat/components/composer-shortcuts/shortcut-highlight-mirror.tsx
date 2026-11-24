"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ShortcutHighlightMirrorProps {
  text: string;
  highlight: { start: number; end: number };
  className?: string;
}

/**
 * Cópia do texto atrás do campo, com a palavra do atalho em azul. O campo fica com texto transparente
 * enquanto ela aparece; mesma fonte, padding e quebra de linha, e a rolagem é copiada pelo `ref`.
 */
export const ShortcutHighlightMirror = forwardRef<HTMLDivElement, ShortcutHighlightMirrorProps>(function ShortcutHighlightMirror(
  { text, highlight, className },
  ref,
) {
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap [overflow-wrap:anywhere] text-foreground",
        className,
      )}
    >
      {text.slice(0, highlight.start)}
      <span className="text-info">{text.slice(highlight.start, highlight.end)}</span>
      {text.slice(highlight.end)}
      {/* Linha final vazia não tem altura sem um caractere. */}
      {"​"}
    </div>
  );
});
