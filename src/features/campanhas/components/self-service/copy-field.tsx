"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Valor com botão "Copiar" e selo animado de copiado (spec 0040, RF-3). */
export function CopyField({
  label,
  value,
  isHighlighted = false,
  isMultiline = false,
}: {
  label: string;
  value: string;
  isHighlighted?: boolean;
  /** Texto longo (mensagem pronta): quebra em linhas e o botão vai para baixo. */
  isMultiline?: boolean;
}) {
  const [isCopied, setIsCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1_800);
    } catch {
      setIsCopied(false);
    }
  }

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <button
        type="button"
        onClick={copyValue}
        className={cn(
          "group flex w-full min-w-0 justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
          isMultiline ? "flex-col items-stretch" : "items-center font-mono",
          isHighlighted && "animate-in fade-in zoom-in-95 border-emerald-500/50 bg-emerald-500/5 text-lg tracking-widest",
        )}
      >
        <span className={cn("min-w-0", isMultiline ? "whitespace-pre-wrap break-words leading-relaxed" : "truncate")}>{value}</span>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 font-sans text-xs transition-all",
            isMultiline && "self-end",
            isCopied ? "bg-emerald-500 text-white" : "bg-background text-muted-foreground group-hover:text-foreground",
          )}
        >
          {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {isCopied ? "Copiado" : "Copiar"}
        </span>
      </button>
    </div>
  );
}
