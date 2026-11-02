"use client";

import { Sparkles } from "lucide-react";

/** Selo "Sugerido pelo Astro" com o porquê em uma linha (spec 0129, RF-5). */
export function AstroSuggestionNote({ reason }: { reason: string | undefined }) {
  if (!reason) return null;
  return (
    <p className="mt-3 flex items-start gap-2 rounded-xl border border-info/25 bg-info/10 px-3 py-2 text-xs leading-snug text-white/75">
      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-info" />
      <span>
        <span className="font-medium text-info">Sugerido pelo Astro.</span> {reason}
      </span>
    </p>
  );
}
